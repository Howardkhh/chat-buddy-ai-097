from __future__ import annotations

import base64
import os
import subprocess
import uuid
from pathlib import Path
from typing import Literal, Optional
import re
import soundfile as sf
import ast
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from higgs import *

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
CURR_DIR = os.path.dirname(os.path.abspath(__file__))


def setup_model():
    device = "cuda:0"
    audio_tokenizer_device = device
    audio_tokenizer = load_higgs_audio_tokenizer("bosonai/higgs-audio-v2-tokenizer", device=audio_tokenizer_device)
    model_client = HiggsAudioModelClient(
        model_path="bosonai/higgs-audio-v2-generation-3B-base",
        audio_tokenizer=audio_tokenizer,
        device=device,
        device_id=0,
        max_new_tokens=2048,
        use_static_kv_cache=1,
    )

    return model_client, audio_tokenizer

def generateAudio(transcript, speaker_tag, ref_audio, temperature, model_client, audio_tokenizer, out_path):
    # pattern = re.compile(r"\[(SPEAKER\d+)\]")

    if os.path.exists(transcript):
        logger.info(f"Loading transcript from {transcript}")
        with open(transcript, "r", encoding="utf-8") as f:
            transcript = f.read().strip()
    
    # initialize
    ref_audio_in_system_message = None
    ref_audio = None
    speaker_json = json.loads(speaker_tag) if speaker_tag is not None else None
    if speaker_tag is not None and os.path.exists(f"{CURR_DIR}/ref_audio/{speaker_json['name'].replace(" ", "")}.wav"):
        print("Found reference audio for the given speaker tag.")
        ref_audio = speaker_json['name'].replace(" ", "")
        ref_audio = f"{CURR_DIR}/ref_audio/{ref_audio}"
        ref_audio_in_system_message = ""
        with open(f"{CURR_DIR}/ref_audio/{speaker_json['name'].replace(" ", "")}.txt", "r", encoding="utf-8") as f:
            ref_audio_in_system_message = f.read()
    else:
        print(f"No reference audio found for the given speaker tag in {CURR_DIR}/ref_audio/{speaker_json['name'].replace(" ", "")}.wav")

    if ref_audio is None or os.path.exists(ref_audio):
        if speaker_tag is None:
            scene_prompt = "{CURR_DIR}/scene_prompts/quiet_indoor.txt"
            with open(scene_prompt, "r", encoding="utf-8") as f:
                scene_prompt = f.read().strip()
        else:
            prompt = speaker_tag
            prompt = ast.literal_eval(prompt)
            scene_prompt = f"""
                You are to generate speech for the following character:

                Character Name: {prompt['name']} {prompt['avatar']}
                Description: {prompt['description']}
                Personality: {prompt['personality']}
                Backstory: {prompt['backstory']}
                Core Traits: {", ".join(prompt['traits'])}
                Voice Style: {prompt['voice']}

                Instructions:
                - Always speak in a way consistent with {prompt['name']}'s personality and traits.
                - Use the {prompt['voice']} tone to match her style.
                - Stay friendly, approachable, and emotionally engaging, just as described.
            """
    else:
        scene_prompt = None

    # speaker_tags = sorted(set(pattern.findall(transcript)))
    # Perform some basic normalization
    transcript = normalize_chinese_punctuation(transcript)
    # Other normalizations (e.g., parentheses and other symbols. Will be improved in the future)
    transcript = transcript.replace("(", " ")
    transcript = transcript.replace(")", " ")
    transcript = transcript.replace("°F", " degrees Fahrenheit")
    transcript = transcript.replace("°C", " degrees Celsius")

    for tag, replacement in [
        ("[laugh]", "<SE>[Laughter]</SE>"),
        ("[humming start]", "<SE_s>[Humming]</SE_s>"),
        ("[humming end]", "<SE_e>[Humming]</SE_e>"),
        ("[music start]", "<SE_s>[Music]</SE_s>"),
        ("[music end]", "<SE_e>[Music]</SE_e>"),
        ("[music]", "<SE>[Music]</SE>"),
        ("[sing start]", "<SE_s>[Singing]</SE_s>"),
        ("[sing end]", "<SE_e>[Singing]</SE_e>"),
        ("[applause]", "<SE>[Applause]</SE>"),
        ("[cheering]", "<SE>[Cheering]</SE>"),
        ("[cough]", "<SE>[Cough]</SE>"),
    ]:
        transcript = transcript.replace(tag, replacement)
    lines = transcript.split("\n")
    transcript = "\n".join([" ".join(line.split()) for line in lines if line.strip()])
    transcript = transcript.strip()

    if not any([transcript.endswith(c) for c in [".", "!", "?", ",", ";", '"', "'", "</SE_e>", "</SE>"]]):
        transcript += "."

    messages, audio_ids = prepare_generation_context(
        scene_prompt=scene_prompt,
        ref_audio=ref_audio,
        ref_audio_in_system_message=ref_audio_in_system_message,
        audio_tokenizer=audio_tokenizer,
        speaker_tags=[],
    )
    chunked_text = prepare_chunk_text(
        transcript,
        chunk_method=None,
        chunk_max_word_num=200,
        chunk_max_num_turns=1,
    )

    logger.info("Chunks used for generation:")
    for idx, chunk_text in enumerate(chunked_text):
        logger.info(f"Chunk {idx}:")
        logger.info(chunk_text)
        logger.info("-----")

    concat_wv, sr, text_output = model_client.generate(
        messages=messages,
        audio_ids=audio_ids,
        chunked_text=chunked_text,
        generation_chunk_buffer_size=None,
        temperature=temperature,
        top_k=1,
        top_p=0.95,
        ras_win_len=7,
        ras_win_max_num_repeat=2,
        seed=12345,
    )

    sf.write(out_path, concat_wv, sr)
    logger.info(f"Wav file is saved to '{out_path}' with sample rate {sr}")


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

model_client, audio_tokenizer = setup_model()

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
    speaker_tag: Optional[str] = None
    ref_audio: Optional[str] = None # wav file path



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
    audio_id = str(uuid.uuid4()) if not req.filename else Path(req.filename).stem + "-" + str(uuid.uuid4())
    out_name = (Path(req.filename).name if req.filename else f"{audio_id}.wav")
    if not out_name.lower().endswith(".wav"):
        out_name += ".wav"
    out_path = OUTPUT_DIR / out_name

    generateAudio(
        transcript=req.transcript,
        speaker_tag=req.speaker_tag,
        ref_audio=req.ref_audio,
        temperature=req.temperature,
        model_client=model_client,
        audio_tokenizer=audio_tokenizer,
        out_path=out_path,
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


