#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path
from typing import Literal

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Call the Higgs Audio simple generation API")
    parser.add_argument("--host", default="http://localhost:8000", help="Server host, e.g., http://localhost:8000")
    parser.add_argument("--text", required=True, help="Transcript text to synthesize")
    parser.add_argument("--temperature", type=float, default=0.35, help="Sampling temperature")
    parser.add_argument(
        "--mode",
        choices=["base64", "url"],
        default="url",
        help="Whether to request base64 or a downloadable URL",
    )
    parser.add_argument("--out", default="client.wav", help="Output path if saving audio")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    endpoint = args.host.rstrip("/") + "/generate"

    payload = {
        "transcript": args.text,
        "temperature": float(args.temperature),
        "return_audio": args.mode,
    }
    try:
        resp = requests.post(endpoint, json=payload, timeout=300)
        resp.raise_for_status()
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 2

    data = resp.json()

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


