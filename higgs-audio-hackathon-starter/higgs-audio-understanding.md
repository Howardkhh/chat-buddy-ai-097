
For detailed API documentation and additional parameters, refer to the [OpenAI API documentation](https://platform.openai.com/docs/api-reference/chat).

## Audio understanding endpoint

Boson provides audio transcription capabilities through the chat completions API using the `higgs-audio-understanding` model. It supports various audio formats (mp3, wav, etc.) with base64 encoding.

### cURL Example
```bash
# First, encode your audio file to base64
AUDIO_BASE64=$(base64 -i /path/to/your/audio.wav)

curl -X POST "http://37.120.212.230:55843/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOSON_API_KEY" \
  -d '{
    "model": "higgs-audio-understanding-7b-v1.0",
    "messages": [
      {"role": "system", "content": "Transcribe the audio."},
      {
        "role": "user",
        "content": [
          {
            "type": "input_audio",
            "input_audio": {
              "data": "'$AUDIO_BASE64'",
              "format": "wav"
            }
          }
        ]
      }
    ],
    "max_completion_tokens": 256,
    "temperature": 0.0
  }'
```

### Python Example
```python
import openai
import base64
import os

BOSON_API_KEY = os.getenv("BOSON_API_KEY")

def encode_audio_to_base64(file_path: str) -> str:
    """Encode audio file to base64 format."""
    with open(file_path, "rb") as audio_file:
        return base64.b64encode(audio_file.read()).decode("utf-8")

client = openai.Client(
    api_key=BOSON_API_KEY,
    base_url="http://37.120.212.230:55843/v1"
)

# Transcribe audio
audio_path = "/path/to/your/audio.wav"
audio_base64 = encode_audio_to_base64(audio_path)
file_format = audio_path.split(".")[-1]

response = client.chat.completions.create(
    model="higgs-audio-understanding-7b-v1.0",
    messages=[
        # The model can also act as a general purpose chat model.
        # It can understand user's questions and directly generate text responses.
        {"role": "system", "content": "You are a helpful assistant."},
        {
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": audio_base64,
                        "format": file_format,
                    },
                },
            ],
        },
    ],
    max_completion_tokens=256,
    temperature=0.0,
)

print(response.choices[0].message.content)
```

For detailed API documentation and additional parameters, refer to the [OpenAI API documentation](http://platform.openai.com/docs/api-reference/chat).
