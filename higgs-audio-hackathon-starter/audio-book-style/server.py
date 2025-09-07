from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import tempfile
import uuid
import wave
from pathlib import Path
from typing import Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(title="Higgs Audio – Simple Generation API")

# Where to write generated audio files
OUTPUT_DIR = Path(os.environ.get("HIGGS_OUT_DIR", "./generated_audio/")).resolve()
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
    voice_refs: Optional[List[str]] = Field(None, description="List of voice reference names")
    ref_audio_in_system_message: bool = Field(False, description="Include voice refs in system message")
    chunk_method: Optional[Literal["auto", "paragraph", "sentence", "speaker"]] = Field(
        None, description="Chunking strategy for long text"
    )
    seed: Optional[int] = Field(None, description="Random seed for deterministic generation")
    persona: Optional[str] = Field(None, description="Speaker persona description")
    style: Optional[Dict] = Field(None, description="Style parameters")
    return_audio: Literal["base64", "url"] = Field(
        "base64", description="Whether to return the audio as base64 or a downloadable URL"
    )
    filename: Optional[str] = Field(
        None,
        description="Optional output filename ('.wav' will be appended if missing). If omitted, a UUID will be used.",
    )

    class Config:
        schema_extra = {
            "example": {
                "transcript": "Hello, this is a test.",
                "style": {
                    "emotion": "happy",
                    "rate_wpm": 150,
                    "pitch_semitones": 0.5,
                    "energy": 1.2,
                    "pause_ms": {"comma": 200, "period": 400, "paragraph": 800},
                },
            }
        }


class GenerateResponse(BaseModel):
    id: str
    temperature: float
    duration_sec: Optional[float] = None
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None
    notes: Optional[List[str]] = None


def _chunk_text(text: str, method: str) -> List[str]:
    """Chunk text based on method."""
    if method == "paragraph":
        # Split on double newlines
        chunks = [p.strip() for p in text.split("\n\n") if p.strip()]
        return chunks
    elif method == "sentence":
        # Simple sentence splitting on . ! ?
        sentences = re.split(r"(?<=[.!?])\s+", text)
        return [s.strip() for s in sentences if s.strip()]
    elif method == "auto":
        # Smart chunking: prefer paragraph breaks, fall back to ~200 word chunks
        paragraphs = text.split("\n\n")
        chunks = []
        for para in paragraphs:
            words = para.split()
            if len(words) <= 200:
                chunks.append(para.strip())
            else:
                # Split large paragraphs
                for i in range(0, len(words), 200):
                    chunk = " ".join(words[i : i + 200])
                    chunks.append(chunk)
        return [c for c in chunks if c]
    else:
        return [text]


def _inject_style_directives(text: str, style: Optional[Dict]) -> str:
    """Inject pause markers based on style settings."""
    if not style or "pause_ms" not in style:
        return text

    pause_ms = style["pause_ms"]
    # Simple approach: add explicit pause markers
    # Note: The model doesn't directly support pause markers, but we can
    # influence pacing through punctuation and formatting
    if pause_ms.get("paragraph"):
        # Ensure double newlines between paragraphs
        text = re.sub(r"\n(?!\n)", "\n\n", text)

    return text


def _build_scene_prompt(
    persona: Optional[str], style: Optional[Dict], base_scene: Optional[str] = None
) -> Optional[str]:
    """Build scene prompt with persona and style directives."""
    parts = []

    if base_scene:
        parts.append(base_scene)

    if persona:
        parts.append(f"The speaker has the following characteristics: {persona}")

    if style:
        style_desc = []
        if "emotion" in style:
            style_desc.append(f"speaking with {style['emotion']} emotion")
        if "rate_wpm" in style:
            style_desc.append(f"at approximately {style['rate_wpm']} words per minute")
        if "pitch_semitones" in style:
            pitch = style["pitch_semitones"]
            if pitch > 0:
                style_desc.append(f"with a slightly higher pitch ({pitch} semitones up)")
            elif pitch < 0:
                style_desc.append(f"with a slightly lower pitch ({abs(pitch)} semitones down)")
        if "energy" in style:
            energy = style["energy"]
            if energy > 1.5:
                style_desc.append("with high energy and enthusiasm")
            elif energy > 1.0:
                style_desc.append("with moderate energy")
            elif energy < 0.7:
                style_desc.append("with calm, low energy")

        if style_desc:
            parts.append(f"The speaker is {', '.join(style_desc)}.")

    return "\n\n".join(parts) if parts else None


def _concat_wav_files(wav_files: List[Path], output_path: Path) -> None:
    """Concatenate multiple WAV files into one."""
    if len(wav_files) == 1:
        # Just copy the single file
        output_path.write_bytes(wav_files[0].read_bytes())
        return

    # Read all WAV files and concatenate
    data = []
    params = None

    for wav_file in wav_files:
        with wave.open(str(wav_file), "rb") as w:
            if params is None:
                params = w.getparams()
            else:
                # Ensure all files have same parameters, except for number of frames
                p_new = w.getparams()
                if (
                    p_new.nchannels != params.nchannels
                    or p_new.sampwidth != params.sampwidth
                    or p_new.framerate != params.framerate
                    or p_new.comptype != params.comptype
                    or p_new.compname != params.compname
                ):
                    raise ValueError(f"WAV file {wav_file} has incompatible format")

            data.append(w.readframes(w.getnframes()))

    # Write concatenated data
    with wave.open(str(output_path), "wb") as out:
        out.setparams(params)
        for chunk in data:
            out.writeframes(chunk)


def _parse_speaker_tags(text: str) -> List[str]:
    """Extract unique speaker tags from text."""
    pattern = re.compile(r"\[(SPEAKER\d+)\]")
    return sorted(set(pattern.findall(text)))


def _run_generation(
    transcript: str,
    temperature: float,
    out_path: Path,
    voice_refs: Optional[List[str]] = None,
    ref_audio_in_system_message: bool = False,
    chunk_method: Optional[str] = None,
    seed: Optional[int] = None,
    scene_prompt: Optional[str] = None,
) -> subprocess.CompletedProcess:
    """Run the generation.py script with given parameters."""

    # Write transcript to temporary file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        f.write(transcript)
        transcript_file = f.name

    # Write scene prompt to temporary file if provided
    scene_file = None
    if scene_prompt:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(scene_prompt)
            scene_file = f.name

    try:
        cmd = [
            "python",
            str(GEN_SCRIPT),
            "--transcript",
            transcript_file,
            "--temperature",
            str(temperature),
            "--out_path",
            str(out_path),
        ]

        if voice_refs:
            cmd.extend(["--ref_audio", ",".join(voice_refs)])

        if ref_audio_in_system_message:
            cmd.append("--ref_audio_in_system_message")

        if chunk_method == "speaker":
            cmd.extend(["--chunk_method", "speaker"])

        if seed is not None:
            cmd.extend(["--seed", str(seed)])

        if scene_file:
            cmd.extend(["--scene_prompt", scene_file])

        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
    finally:
        # Clean up temp files
        os.unlink(transcript_file)
        if scene_file:
            os.unlink(scene_file)


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
    audio_id = str(uuid.uuid4()) if not req.filename else Path(req.filename).stem + "-" + str(uuid.uuid4())
    out_name = Path(req.filename).name if req.filename else f"{audio_id}.wav"
    if not out_name.lower().endswith(".wav"):
        out_name += ".wav"
    out_path = OUTPUT_DIR / out_name

    notes = []

    # Process transcript with style injections
    transcript = _inject_style_directives(req.transcript, req.style)

    # Build scene prompt
    scene_prompt = _build_scene_prompt(req.persona, req.style)

    # Determine effective chunk method
    chunk_method = req.chunk_method
    speaker_tags = _parse_speaker_tags(transcript)

    # Auto-detect multi-speaker mode
    if not chunk_method and len(speaker_tags) > 1:
        chunk_method = "speaker"
        notes.append(f"Auto-detected multi-speaker mode with {len(speaker_tags)} speakers")

    # Handle chunking
    if chunk_method and chunk_method != "speaker":
        # Custom chunking - we'll generate multiple files and concatenate
        chunks = _chunk_text(transcript, chunk_method)
        if len(chunks) > 1:
            notes.append(f"Split into {len(chunks)} chunks using {chunk_method} method")

        wav_files = []
        reference_txt_file = None
        effective_voice_refs = req.voice_refs.copy() if req.voice_refs else []

        for i, chunk in enumerate(chunks):
            chunk_path = OUTPUT_DIR / f"{audio_id}_chunk_{i}.wav"
            try:
                _run_generation(
                    transcript=chunk,
                    temperature=req.temperature,
                    out_path=chunk_path,
                    voice_refs=effective_voice_refs,
                    ref_audio_in_system_message=req.ref_audio_in_system_message,
                    chunk_method=None,  # Don't chunk individual chunks
                    seed=req.seed,
                    scene_prompt=scene_prompt,
                )
                wav_files.append(chunk_path)

                # If no initial voice refs were provided, use the first generated chunk
                # as the reference for all subsequent chunks.
                if i == 0 and not req.voice_refs:
                    # The generation script expects a .txt file alongside the .wav reference
                    reference_txt_file = chunk_path.with_suffix(".txt")
                    reference_txt_file.write_text(chunk)

                    effective_voice_refs = [str(chunk_path.with_suffix(""))]
                    notes.append("Using first chunk as voice reference for consistency.")

            except subprocess.CalledProcessError as e:
                # Clean up partial files
                for f in wav_files:
                    f.unlink(missing_ok=True)
                if reference_txt_file:
                    reference_txt_file.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=500,
                    detail={
                        "message": f"Generation failed on chunk {i+1}/{len(chunks)}",
                        "stderr": e.stderr[-2000:],
                        "stdout": e.stdout[-2000:],
                    },
                )

        # Concatenate chunks
        try:
            _concat_wav_files(wav_files, out_path)
            # Clean up chunk files
            for f in wav_files:
                f.unlink(missing_ok=True)
            if reference_txt_file:
                reference_txt_file.unlink(missing_ok=True)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to concatenate audio chunks: {str(e)}")
    else:
        # Single generation or native speaker chunking
        try:
            _run_generation(
                transcript=transcript,
                temperature=req.temperature,
                out_path=out_path,
                voice_refs=req.voice_refs,
                ref_audio_in_system_message=req.ref_audio_in_system_message,
                chunk_method=chunk_method,
                seed=req.seed,
                scene_prompt=scene_prompt,
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
            notes=notes if notes else None,
        )
    else:
        # Return a URL the client can download
        url = f"{str(request.base_url).rstrip('/')}/audio/{out_path.name}"
        return GenerateResponse(
            id=audio_id,
            temperature=req.temperature,
            audio_url=url,
            notes=notes if notes else None,
        )


