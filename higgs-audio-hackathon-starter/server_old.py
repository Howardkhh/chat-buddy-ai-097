from __future__ import annotations

import base64
import os
import subprocess
import uuid
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Higgs Audio – Simple Generation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",      # Vite/webpack dev server origin
        "http://127.0.0.1:8080",
    ],
    allow_credentials=False,          # set True only if you send cookies/auth
    allow_methods=["*"],              # POST/GET/OPTIONS etc.
    allow_headers=["*"],              # Content-Type, Authorization, etc.
)

# Where to write generated audio files
OUTPUT_DIR = Path(os.environ.get("HIGGS_OUT_DIR", "/tmp/higgs_audio_out")).resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _find_generation_script() -> Path:
    """
    Try to locate the generation script:
    1) repo relative (when server runs from inside the repo)
    2) HIGGS_AUDIO_REPO env var
    """
    local = Path("examples/generation.py").resolve()
    if local.exists():
        return local
    env_repo = os.environ.get("HIGGS_AUDIO_REPO")
    if env_repo:
        p = Path(env_repo) / "examples" / "generation.py"
        if p.exists():
            return p.resolve()
    raise FileNotFoundError(
        "Could not locate examples/generation.py. "
        "Run this server from inside the higgs-audio repo, "
        "or set HIGGS_AUDIO_REPO=/path/to/higgs-audio"
    )


GEN_SCRIPT = _find_generation_script()

# Mount static serving for generated files (downloadable URLs)
app.mount("/audio", StaticFiles(directory=str(OUTPUT_DIR)), name="audio")


class GenerateRequest(BaseModel):
    transcript: str = Field(..., description="Text to turn into speech/audio")
    temperature: float = Field(0.35, ge=0.0, le=2.0, description="Sampling temperature")
    return_audio: Literal["base64", "url"] = Field(
        "base64", description="Whether to return the audio as base64 or a downloadable URL"
    )
    filename: Optional[str] = Field(
        None,
        description="Optional output filename ('.wav' will be appended if missing). If omitted, a UUID will be used.",
    )


class GenerateResponse(BaseModel):
    id: str
    temperature: float
    duration_sec: Optional[float] = None
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None


@app.get("/health")
def health() -> dict:
    # Best-effort GPU check (won't raise if nvidia-smi missing)
    try:
        smi = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            text=True,
            timeout=3,
        ).strip()
    except Exception:
        smi = "unavailable"
    return {"status": "ok", "gpu": smi}


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest, request: Request) -> GenerateResponse:
    # Resolve output filename
    print("Got POST")
    audio_id = str(uuid.uuid4()) if not req.filename else Path(req.filename).stem + "-" + str(uuid.uuid4())
    out_name = (Path(req.filename).name if req.filename else f"{audio_id}.wav")
    if not out_name.lower().endswith(".wav"):
        out_name += ".wav"
    out_path = OUTPUT_DIR / out_name

    # Build the CLI call to the example script
    cmd = [
        "python",
        str(GEN_SCRIPT),
        "--transcript",
        req.transcript,
        "--temperature",
        str(req.temperature),
        "--out_path",
        str(out_path),
    ]

    try:
        completed = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Generation failed",
                "stderr": e.stderr[-2000:],  # tail for brevity
                "stdout": e.stdout[-2000:],
            },
        )

    if not out_path.exists():
        raise HTTPException(status_code=500, detail="Expected output file was not created.")

    if req.return_audio == "base64":
        b = out_path.read_bytes()
        b64 = base64.b64encode(b).decode("utf-8")
        return GenerateResponse(
            id=audio_id,
            temperature=req.temperature,
            audio_base64=b64,
        )
    else:
        # Return a URL the client can download
        url = f"{str(request.base_url).rstrip('/')}/audio/{out_path.name}"
        return GenerateResponse(
            id=audio_id,
            temperature=req.temperature,
            audio_url=url,
        )


