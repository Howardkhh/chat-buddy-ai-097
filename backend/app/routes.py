from flask import Blueprint, request, jsonify
from datetime import datetime
from .core.llm import getResponse

bp = Blueprint("api", __name__)

@bp.post("/turn")
def turn():
    if "audio" not in request.files:
        return jsonify({"error": "no 'audio' file in form-data"}), 400
    audio_bytes = request.files["audio"].read()
    # TODO: (optional) validate WAV vs. raw PCM
    try:
        text = getResponse(audio_bytes)  # <-- your ASR + LLM pipeline
        return jsonify({"text": text, "ts": datetime.utcnow().isoformat() + "Z"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
