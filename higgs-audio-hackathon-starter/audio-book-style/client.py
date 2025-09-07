#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path
from typing import Literal

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Call the Higgs Audio simple generation API")
    parser.add_argument("--host", default="http://localhost:8000", help="Server host, e.g., http://localhost:8000")
    parser.add_argument("--text", help="Transcript text to synthesize")
    parser.add_argument("--file", help="Read transcript from file instead of --text")
    parser.add_argument("--temperature", type=float, default=0.35, help="Sampling temperature")
    parser.add_argument("--voice-refs", help="Comma-separated list of voice references")
    parser.add_argument("--ref-in-system", action="store_true", help="Include voice refs in system message")
    parser.add_argument("--chunk-method", choices=["auto", "paragraph", "sentence", "speaker"], help="Chunking method")
    parser.add_argument("--seed", type=int, help="Random seed for deterministic generation")
    parser.add_argument("--persona", help="Speaker persona description")
    parser.add_argument("--emotion", help="Emotional tone (e.g., happy, sad, excited)")
    parser.add_argument("--rate-wpm", type=int, help="Speaking rate in words per minute")
    parser.add_argument("--pitch-semitones", type=float, help="Pitch offset in semitones")
    parser.add_argument("--energy", type=float, help="Energy/intensity level (0.5-2.0)")
    parser.add_argument("--pause-comma", type=int, default=200, help="Pause after comma in ms")
    parser.add_argument("--pause-period", type=int, default=400, help="Pause after period in ms")
    parser.add_argument("--pause-paragraph", type=int, default=800, help="Pause between paragraphs in ms")
    parser.add_argument(
        "--mode",
        choices=["base64", "url"],
        default="url",
        help="Whether to request base64 or a downloadable URL",
    )
    parser.add_argument("--out", default="client.wav", help="Output path if saving audio")
    parser.add_argument("--filename", help="Preferred filename on server (without .wav)")
    parser.add_argument("--timeout", type=int, default=1200, help="Request timeout in seconds")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    endpoint = args.host.rstrip("/") + "/generate"

    if not args.text and not args.file:
        print("Error: either --text or --file must be provided.", file=sys.stderr)
        # In python 3.10+ we could use parser.error()
        return 1

    # Get transcript text
    if args.file:
        try:
            transcript = Path(args.file).read_text(encoding="utf-8")
        except Exception as e:
            print(f"Failed to read file {args.file}: {e}", file=sys.stderr)
            return 1
    else:
        transcript = args.text

    # Build style dictionary if any style args provided
    style = None
    if any(
        [
            args.emotion,
            args.rate_wpm,
            args.pitch_semitones,
            args.energy,
            args.pause_comma != 200,
            args.pause_period != 400,
            args.pause_paragraph != 800,
        ]
    ):
        style = {}
        if args.emotion:
            style["emotion"] = args.emotion
        if args.rate_wpm:
            style["rate_wpm"] = args.rate_wpm
        if args.pitch_semitones is not None:
            style["pitch_semitones"] = args.pitch_semitones
        if args.energy:
            style["energy"] = args.energy
        style["pause_ms"] = {
            "comma": args.pause_comma,
            "period": args.pause_period,
            "paragraph": args.pause_paragraph,
        }

    payload = {
        "transcript": transcript,
        "temperature": float(args.temperature),
        "return_audio": args.mode,
    }

    # Add optional fields
    if args.voice_refs:
        payload["voice_refs"] = args.voice_refs.split(",")
    if args.ref_in_system:
        payload["ref_audio_in_system_message"] = True
    if args.chunk_method:
        payload["chunk_method"] = args.chunk_method
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.persona:
        payload["persona"] = args.persona
    if style:
        payload["style"] = style
    if args.filename:
        payload["filename"] = args.filename

    try:
        resp = requests.post(endpoint, json=payload, timeout=args.timeout)
        resp.raise_for_status()
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        if isinstance(e, requests.exceptions.HTTPError):
            try:
                error_detail = e.response.json()
                print("Server error details:", file=sys.stderr)
                print(json.dumps(error_detail, indent=2), file=sys.stderr)
            except json.JSONDecodeError:
                print("Could not decode server error response as JSON:", file=sys.stderr)
                print(e.response.text, file=sys.stderr)
        return 2

    data = resp.json()

    # Print any notes from server
    if "notes" in data and data["notes"]:
        for note in data["notes"]:
            print(f"Note: {note}")

    if args.mode == "base64":
        b64 = data.get("audio_base64")
        if not b64:
            print("No audio_base64 in response", file=sys.stderr)
            return 3
        out_path = Path(args.out)
        out_path.write_bytes(base64.b64decode(b64))
        print(f"Saved: {out_path}")
        return 0

    # mode == "url"
    audio_url = data.get("audio_url")
    if not audio_url:
        print("No audio_url in response", file=sys.stderr)
        return 4
    print(f"Audio URL: {audio_url}")

    # Also download if --out provided
    try:
        r = requests.get(audio_url, timeout=300)
        r.raise_for_status()
        Path(args.out).write_bytes(r.content)
        print(f"Downloaded to: {args.out}")
    except Exception as e:
        print(f"Warning: could not download audio: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


