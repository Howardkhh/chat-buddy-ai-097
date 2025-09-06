import base64
import openai

BOSON_API_KEY = "fdjshifohudsoiaf"
client = openai.Client(
    api_key=BOSON_API_KEY,
    base_url="http://37.120.212.230:55843/v1"
)

def getResponse(audio) -> str:
    audio_base64 = base64.b64encode(audio).decode("utf-8")

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
                            "format": "wav",
                        },
                    },
                ],
            },
        ],
        max_completion_tokens=256,
        temperature=0.0,
    )

    return response.choices[0].message.content