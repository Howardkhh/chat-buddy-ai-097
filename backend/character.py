import os, uuid, json
from datetime import datetime

DATA_FILE = "./characters.json"


class Character:
    def __init__(self, name="", personality="", description="", 
                 avatar="🤖", voice="neutral-calm", traits=None, backstory="", id=None):
        self.id = id or str(uuid.uuid4())
        self.name = name
        self.personality = personality
        self.description = description
        self.avatar = avatar
        self.voice = voice
        self.traits = traits or []
        self.backstory = backstory
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "personality": self.personality,
            "description": self.description,
            "avatar": self.avatar,
            "voice": self.voice,
            "traits": self.traits,
            "backstory": self.backstory,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    @classmethod
    def from_dict(cls, data):
        character = cls(
            name=data.get("name", ""),
            personality=data.get("personality", ""),
            description=data.get("description", ""),
            avatar=data.get("avatar", "🤖"),
            voice=data.get("voice", "neutral-calm"),
            traits=data.get("traits", []),
            backstory=data.get("backstory", ""),
            id=data.get("id")
        )
        character.created_at = data.get("created_at", character.created_at)
        character.updated_at = data.get("updated_at", character.updated_at)
        return character

class CharacterManager:
    def __init__(self):
        self.characters = {}
        self.load_data()
        
        # 如果沒有數據，創建默認角色
        if not self.characters:
            self._create_default_characters()
    
    def load_data(self):
        """從文件加載角色數據"""
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for char_data in data:
                        character = Character.from_dict(char_data)
                        self.characters[character.id] = character
            except Exception as e:
                print(f"載入數據時出錯: {e}")
    
    def save_data(self):
        """保存角色數據到文件"""
        try:
            data = [char.to_dict() for char in self.characters.values()]
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存數據時出錯: {e}")
    
    def _create_default_characters(self):
        """創建默認角色"""
        default_chars = [
            {
                "name": "Luna",
                "personality": "Helpful and empathetic AI assistant",
                "description": "A caring and knowledgeable companion who loves to help with any task.",
                "avatar": "🌙",
                "voice": "female-calm",
                "traits": ["Helpful", "Empathetic", "Patient", "Knowledgeable"],
                "backstory": "Luna was designed to be the perfect assistant, with deep understanding of human emotions and needs."
            },
            {
                "name": "Alex",
                "personality": "Creative and artistic thinker",
                "description": "An imaginative AI with a passion for creative writing and storytelling.",
                "avatar": "✨",
                "voice": "neutral-energetic",
                "traits": ["Creative", "Artistic", "Imaginative", "Inspiring"],
                "backstory": "Alex draws inspiration from countless stories and creative works to help others express their ideas."
            }
        ]
        
        for char_data in default_chars:
            character = Character(**char_data)
            self.characters[character.id] = character
        
        self.save_data()
    
    def get_all_characters(self):
        """獲取所有角色"""
        return [char.to_dict() for char in self.characters.values()]
    
    def get_character(self, id):
        """根據ID獲取角色"""
        return self.characters.get(id)
    
    def create_character(self, character_data):
        """創建新角色"""
        character = Character(**character_data)
        self.characters[character.id] = character
        self.save_data()
        return character
    
    def update_character(self, id, character_data):
        """更新角色"""
        if id in self.characters:
            character = self.characters[id]
            
            # 更新屬性
            for key, value in character_data.items():
                if hasattr(character, key) and key != 'id':
                    setattr(character, key, value)
            
            character.updated_at = datetime.now().isoformat()
            self.save_data()
            return character
        return None
    
    def delete_character(self, id):
        """刪除角色"""
        if id in self.characters:
            del self.characters[id]
            self.save_data()
            return True
        return False