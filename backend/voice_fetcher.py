#!/usr/bin/env python3
"""
End-to-end: search YouTube for a celebrity/character voice and get a transcript.

Flow:
1) Search YouTube via yt_dlp (no API key).
2) For each result, try to pull official captions via youtube_transcript_api.
3) If captions unavailable, download audio and transcribe locally with Whisper.

Outputs a JSONL file with one record per video containing:
- video_id, title, url, source ("captions" or "whisper"), and transcript text.

Usage:
  python search_and_transcribe.py --query "Morgan Freeman interview" --limit 3 --whisper-model base

Tip:
  Add --lang en to prefer English captions; omit to auto-detect.
"""

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

from tqdm import tqdm

# --- YouTube search & download (no API key) ---
import yt_dlp

# --- Try official captions first ---
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound, CouldNotRetrieveTranscript

# --- Local transcription ---
# import whisper


def search_youtube(query: str, limit: int = 5):
    """
    Uses yt_dlp to perform a YouTube search without downloading the media.
    Returns a list of dicts with video_id, title, url, duration, uploader, etc.
    """
    ydl_opts = {
        "quiet": True,
        "skip_download": True,
        "extract_flat": True,   # we only need metadata here
        "default_search": "ytsearch",
        "noplaylist": True,
    }
    entries = []
    search_term = f"ytsearch{limit}:{query}"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(search_term, download=False)
        # print(info)
        for e in info.get("entries", []):
            if e.get("_type") == "url":
                entries.append({
                    "video_id": e.get("id"),
                    "title": e.get("title"),
                    "url": f"https://www.youtube.com/watch?v={e.get('id')}",
                    "duration": e.get("duration"),
                    "uploader": e.get("uploader"),
                })
    # print(entries)
    return entries


def try_fetch_captions(video_id: str, lang_preference, max_seconds=5):
    """
    Try to fetch official captions. If lang_preference list provided, try that first,
    otherwise get the first available transcript and translate to English if needed.
    Returns transcript text or None.
    """
    try:
        yt_api = YouTubeTranscriptApi()
        # Try preferred languages first (e.g., ["en"])
        transcript_list = yt_api.list(video_id)
        for code in lang_preference:
            try:
                t = transcript_list.find_transcript([code])
                chunks = t.fetch()
                return " ".join([c.text for c in chunks if c.text.strip() and c.start < max_seconds])
            except NoTranscriptFound:
                continue

        # Fallback: try auto-generated in preferred language
        for code in lang_preference:
            try:
                t = transcript_list.find_generated_transcript([code])
                chunks = t.fetch()
                return " ".join([c.text for c in chunks if c.text.strip() and c.start < max_seconds])
            except NoTranscriptFound:
                continue

        # If nothing in preferred language, just grab the first available and translate to English
        t = transcript_list.find_manually_created_transcript([tr.language_code for tr in transcript_list])
        chunks = t.fetch()
        return " ".join([c["text"] for c in chunks if c["text"].strip() and c.start < max_seconds])
    except (TranscriptsDisabled, NoTranscriptFound, CouldNotRetrieveTranscript, KeyError):
        return None


def download_audio(url: str, out_dir: Path, filename: str) -> Path:
    """
    Download best audio to a .mp3 (or .m4a) file via yt_dlp.
    Returns the file path.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    safe_name = sanitize_filename(filename)
    out_tmpl = str(out_dir / f"{safe_name}.%(ext)s")
    ydl_opts = {
        "quiet": True,
        "format": "bestaudio/best",
        "outtmpl": out_tmpl,
        "postprocessors": [
            {"key": "FFmpegExtractAudio", "preferredcodec": "wav", "preferredquality": "192"}
        ],
        "postprocessor_args": ["-t", "5", "-ar", "16000"],  # downsample to 16k for STT efficiency
        "prefer_ffmpeg": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        vid = info.get("id")
        # After postprocess, expect an mp3 with that id
        candidate = out_dir / f"{vid}.wav"
        if not candidate.exists():
            # Fallback: find the file with this base id
            for p in out_dir.glob(f"{vid}.*"):
                return p
        return candidate


def sanitize_filename(s: str) -> str:
    return re.sub(r"[^\w\-. ]", "_", s).strip()[:150]


def fetch(character_name, out_dir):
    query = f"{character_name} voice sample"
    limit = 3
    lang_pref = ["en"]
    out = character_name.replace(" ", "")

    print(f"Searching YouTube for: {query} (limit={limit})")
    items = search_youtube(query, limit=limit)
    if not items:
        print("No results found.")
        sys.exit(0)

    for item in items:
        vid = item["video_id"]
        url = item["url"]

        # 1) Try official captions
        transcript_text = try_fetch_captions(vid, lang_preference=lang_pref)

        if not transcript_text:
            continue

        with open(f"{out_dir}/{out}.txt", "w") as f:
            f.write(transcript_text)

        download_audio(url, Path(f"{out_dir}"), out)
        
        return
