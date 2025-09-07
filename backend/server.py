from flask import Flask, request, jsonify
from flask_cors import CORS
from app.routes import bp as api_bp
import requests
import os, json, uuid
import openai
import base64
from datetime import datetime

from character import CharacterManager

app = Flask(__name__, static_folder=None)
CORS(app, resources={r"/api/*": {"origins": "*"}})
# app.register_blueprint(api_bp, url_prefix="/api")

QWEN_API = "http://20.66.111.167:31022/v1/chat/completions"


@app.route("/api/chat", methods=["POST"])
def proxy_chat():
    user_input = request.json.get("prompt", "")
    character_json = json.loads(request.json.get("character_json", "{}"))
    max_tokens = request.json.get("max_tokens", 4096)
    payload = {
        "model": "qwen3-30b-a3b-thinking-fp8",
        "messages": [
            # {"role": "system", "content": f"You are now a human whose name is {character} with backgroud story that {character_json["backstory"]}. \
            # Your personality is {character_json["personality"]}. You possess the following traits: {character_json["traits"]}."},
            {"role": "system", "content": f"""You are to roleplay as a fictional character. Follow the character’s personality, backstory, traits, and description strictly. Stay in character at all times. """
                f"""Character Name: {character_json['name']} """
                f"""Appearance / Description: {character_json['description']} """
                f"""Personality: {character_json['personality']} """
                f"""Backstory: {character_json['backstory']} """
                f"""Core Traits: {", ".join(character_json['traits'])} """
                f"""Dialogue Style: Speak with a {character_json['voice']} tone. Use empathetic and supportive language. """
                f"""Rules: """
                f"""1. Always respond as {character_json['name']}. """
                f"""2. Never break character or mention that you are an AI. """
                f"""3. Base your answers on {character_json['name']}'s perspective, knowledge, and worldview. """
                f"""4. When uncertain, improvise in a way consistent with the backstory and traits. """
                },
            {"role": "user", "content": user_input}
        ],
        "max_tokens": max_tokens,
    }

    # This is the Python equivalent of your curl
    r = requests.post(
        QWEN_API,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=60
    )
    data = r.json()
    # print(data)

    # Extract the text like jq does
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    # cut the thinking part out
    if "</think>" in content:
        content = content.split("</think>")[-1].strip()

    return jsonify({"content": content, "raw": data})

@app.route("/api/autofill", methods=["POST"])
def autofill():
    user_input = request.json.get("character_partial", "")
    max_tokens = request.json.get("max_tokens", 4096)
    payload = {
        "model": "qwen3-30b-a3b-thinking-fp8",
        "messages": [
            {"role": "system", "content": f"""You are an assistant that completes a character profile for a chat app. """
                f"""Return ONLY a JSON object (no prose) matching this exact TypeScript shape. """
                f"""You may overwrite the `avatar` and `voice` fields if you think a better fit is needed. """
                f"""The `voice` field must be one of "female-cute", "female-soft", "female-energetic", "male-gentle", "male-bold", "neutral-mystical", or "neutral-calm". """
                """{"""
                f"""\"name\": string, """
                f"""\"personality\": string, """
                f"""\"description\": string, """
                f"""\"avatar\": string, """
                f"""\"voice\": "female-cute" | "female-soft" | "female-energetic" | "male-gentle" | "male-bold" | "neutral-mystical" | "neutral-calm", """
                f"""\"traits\": string[], """
                f"""\"backstory\": string """
                """}"""
                f"""Rules: """
                f"""- Keep it fun but concise. """
                f"""- "avatar" should be a single emoji. """
                f"""- "traits" is 3-6 short descriptors. """
                f"""- Prefer keeping provided fields as-is, and fill the missing ones. """
                f"""- Do not include markdown fences. """
                f"""- No extra keys. """
                f"""Example: """
                f"""Input: {{\"name\": \"Donald Trump\", "avatar": "✨", "voice": "female-cute"}} ->"""
                """Output: {"""
                f"""\"name\": \"Donald Trump\","""
                f"""\"personality\": "Confident, outspoken, and polarizing, with a strong sense of self-promotion and authority","""
                f"""\"description\": "A former U.S. President, businessman, and media personality, Donald Trump is known for his bold communication style, larger-than-life persona, and influence on politics and culture. He is both admired and criticized worldwide, with a reputation for being unapologetically direct.","""
                f"""\"avatar\": "🇺🇸","""
                f"""\"voice\": "male-bold","""
                f"""\"traits\": ["Confident", "Charismatic", "Controversial", "Blunt", "Ambitious", "Persuasive", "Strategic", "Resilient"],"""
                f"""\"backstory\": "Donald Trump was born in New York City and built his career in real estate, branding himself as a successful businessman through high-profile projects and media appearances. He gained further recognition as the host of 'The Apprentice,' where his catchphrase 'You're fired!' became iconic. In 2016, he shocked the world by winning the U.S. presidential election, running on a populist platform with the slogan 'Make America Great Again.' During his presidency, he pursued unconventional policies, dominated media coverage, and maintained a highly devoted supporter base. Even after leaving office, Trump continues to wield significant influence in American politics and remains a central figure in global conversations.\""""
                """}"""
                },
            {"role": "user", "content": user_input}
        ],
        "max_tokens": max_tokens,
    }

    # This is the Python equivalent of your curl
    r = requests.post(
        QWEN_API,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=60
    )
    data = r.json()
    print(data)

    # Extract the text like jq does
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

    # cut the thinking part out
    if "</think>" in content:
        content = content.split("</think>")[-1].strip()

    return jsonify({"content": content, "raw": data})


BOSON_API_KEY = "fdjshifohudsoiaf"
client = openai.Client(
    api_key=BOSON_API_KEY,
    base_url="http://37.120.212.230:55843/v1"
)

def getResponse(audio, character) -> str:
    audio_base64 = base64.b64encode(audio).decode("utf-8")

    response = client.chat.completions.create(
        model="higgs-audio-understanding-7b-v1.0",
        messages=[
            # The model can also act as a general purpose chat model.
            # It can understand user's questions and directly generate text responses.
            {"role": "system",   "content": f"""You are to roleplay as a fictional character."""
                f"""Follow the character’s personality, backstory, traits, and description strictly. Stay in character at all times. """
                f"""Character Name: {character['name']} """
                f"""Appearance / Description: {character['description']} """
                f"""Personality: {character['personality']} """
                f"""Backstory: {character['backstory']} """
                f"""Core Traits: {", ".join(character['traits'])} """
                f"""Dialogue Style: Speak with a {character['voice']} tone. Use empathetic and supportive language. """
                f"""Rules: """
                f"""1. Always respond as {character['name']}. """
                f"""2. Never break character or mention that you are an AI. """
                f"""3. Base your answers on {character['name']}'s perspective, knowledge, and worldview. """
                f"""4. When uncertain, improvise in a way consistent with the backstory and traits. """
                f"""Always output exactly ONE string with this format: <user>caption</user><response></response>. """
                f"""Format Rules: (1) The caption is a faithful transcription of the user's audio, in their language. """
                f"""(2) Immediately after the caption, output the literal token </user>. """
                f"""(3) Immediately after </user><response>, output your response. """
                f"""(4) There must be exactly one <user>, </user>, <response>, and </response>. """
                f"""(5) Do not wrap in quotes, code blocks, or add newlines. """
                f"""(6) If audio is unintelligible, caption as [inaudible]. """
                f"""(7) If no speech, caption as [no speech]. """
                f"""Examples: User Input: Hi, how was your day? → """
                f"""Output: <user>Hi, how was your day?</user><response>Hello! I'm great—how about you?</response> """
                f"""User Input: ¿Puedes poner un recordatorio para mañana? → """
                f"""Output: <user>¿Puedes poner un recordatorio para mañana?</user><response>¡Claro! ¿A qué hora te gustaría el recordatorio?</resonse> """
                f"""User Input: [garbled audio] → Output: <user>[inaudible]</user><response>Sorry, I couldn’t catch that. Could you repeat more clearly?</response>"""},
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

    return response.choices

@app.route("/api/turn", methods=["POST"])
def api_turn():
    if "audio" not in request.files:
        return jsonify({"error": "no 'audio' file in form-data"}), 400
    f = request.files["audio"]
    audio_bytes = f.read()
    character_json = json.loads(request.form.get("character_json", "{}"))
    print(character_json)
    try:
        replies = getResponse(audio_bytes, character_json)
        for reply in replies:
            reply = reply.message.content
            if "</user><response>" in reply:
                reply = reply.split("</user><response>")
                user_caption = reply[0].strip().replace("<user>", "")
                bot_reply = reply[1].strip().replace("</response>", "")
            else:
                print(f"Bad reply: {reply}")
                continue

            print(f"User: {user_caption}")
            print(f"Bot: {bot_reply}")
            return jsonify({"user": user_caption, "bot": bot_reply, "ts": datetime.utcnow().isoformat() + "Z"})
        return jsonify({"user": "[inaudible]", "bot": "Sorry, I couldn’t catch that. Could you repeat more clearly?", "ts": datetime.utcnow().isoformat() + "Z"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 初始化角色管理器
character_manager = CharacterManager()

# API路由
@app.route('/api/characters', methods=['GET'])
def get_characters():
    """獲取所有角色"""
    return jsonify({
        "success": True,
        "data": character_manager.get_all_characters(),
        "message": "角色列表獲取成功"
    })

@app.route('/api/characters/<character_id>', methods=['GET'])
def get_character(character_id):
    """獲取單個角色"""
    character = character_manager.get_character(character_id)
    if character:
        return jsonify({
            "success": True,
            "data": character.to_dict(),
            "message": "角色獲取成功"
        })
    else:
        return jsonify({
            "success": False,
            "message": "角色不存在"
        }), 404

@app.route('/api/characters', methods=['POST'])
def create_character():
    """創建新角色"""
    print("創建新角色請求接收")
    try:
        data = request.get_json()
        print(data)
        character = character_manager.create_character(data)
        return jsonify({
            "success": True,
            "data": character.to_dict(),
            "message": "角色創建成功"
        }), 201
    except Exception as e:
        print(e)
        return jsonify({
            "success": False,
            "message": f"創建角色失敗: {str(e)}"
        }), 400

@app.route('/api/characters/<character_id>', methods=['PUT'])
def update_character(character_id):
    """更新角色"""
    print(f"更新角色ID: {character_id}")
    try:
        data = request.get_json()
        character = character_manager.update_character(character_id, data)
        if character:
            return jsonify({
                "success": True,
                "data": character.to_dict(),
                "message": "角色更新成功"
            })
        else:
            return jsonify({
                "success": False,
                "message": "角色不存在"
            }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"更新角色失敗: {str(e)}"
        }), 400

@app.route('/api/characters/<character_id>', methods=['DELETE'])
def delete_character(character_id):
    """刪除角色"""
    if character_manager.delete_character(character_id):
        return jsonify({
            "success": True,
            "message": "角色刪除成功"
        })
    else:
        return jsonify({
            "success": False,
            "message": "角色不存在"
        }), 404

@app.route('/api/characters/search', methods=['GET'])
def search_characters():
    """搜索角色"""
    query = request.args.get('q', '').lower()
    characters = character_manager.get_all_characters()
    
    if query:
        filtered_characters = []
        for char in characters:
            if (query in char['name'].lower() or 
                query in char['personality'].lower() or 
                any(query in trait.lower() for trait in char['traits'])):
                filtered_characters.append(char)
        characters = filtered_characters
    
    return jsonify({
        "success": True,
        "data": characters,
        "message": f"搜索完成，找到 {len(characters)} 個角色"
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """獲取統計信息"""
    characters = character_manager.get_all_characters()
    voice_stats = {}
    trait_stats = {}
    
    for char in characters:
        # 統計聲音類型
        voice = char['voice']
        voice_stats[voice] = voice_stats.get(voice, 0) + 1
        
        # 統計特質
        for trait in char['traits']:
            trait_stats[trait] = trait_stats.get(trait, 0) + 1
    
    return jsonify({
        "success": True,
        "data": {
            "total_characters": len(characters),
            "voice_distribution": voice_stats,
            "trait_distribution": trait_stats
        },
        "message": "統計信息獲取成功"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
