import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Send, Plus, MoreVertical, Phone, PhoneOff, Mic, MicOff, Heart, Star, Sparkles, Settings, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chatWithQwen } from "@/lib/api";
import { TypingBubble } from "@/components/TypingBubble";
import VoiceCaptionOverlay, { Caption as VCaption } from "@/components/VoiceCaptionOverlay"
import { useVoiceTurn } from "@/hooks/useVoiceTurn";
import { loadVoiceSettings } from "@/lib/voiceSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  characterId: string;
  kind?: "text" | "typing";
}

interface Character {
  id: string;
  name: string;
  personality: string;
  description: string;
  avatar: string;
  voice: string;
  traits: string[];
  backstory: string;
  lastMessage?: string;
  created_at?: string;
  updated_at?: string;
}

// API配置
const API_BASE_URL = "http://localhost:8000/api";

// API服務類
class CharacterAPI {
  static async fetchCharacters(): Promise<Character[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/characters`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (error) {
      console.error("獲取角色失敗:", error);
      return [];
    }
  }

  static async createCharacter(characterData: Omit<Character, 'id' | 'created_at' | 'updated_at'>): Promise<Character | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/characters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(characterData),
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error("創建角色失敗:", error);
      return null;
    }
  }

  static async updateCharacter(id: string, characterData: Partial<Character>): Promise<Character | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/characters/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(characterData),
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error("更新角色失敗:", error);
      return null;
    }
  }

  static async deleteCharacter(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/characters/${id}`, {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error("刪除角色失敗:", error);
      return false;
    }
  }
}

const ChatInterface = () => {
  const [threads, setThreads] = useState<Record<string, Message[]>>({
    "1": [
      {
        id: "1",
        content:
          "Kyaa~! Hello there! I'm Luna-chan, your kawaii AI assistant! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ How can I help you today? ✨",
        sender: "ai",
        timestamp: new Date(),
        characterId: "1",
      },
    ],
  });

  
  const [inputValue, setInputValue] = useState("");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacter, setActiveCharacter] = useState<string>("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [newCharacter, setNewCharacter] = useState<Partial<Character>>({
    name: "",
    personality: "",
    description: "",
    avatar: "✨",
    voice: "female-cute",
    traits: [],
    backstory: ""
  });
  const [newTrait, setNewTrait] = useState("");

  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false)
  const [captions, setCaptions] = useState<VCaption[]>([])
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const [thresholdDb, setThresholdDb] = useState(loadVoiceSettings().thresholdDb);

  useEffect(() => {
    loadCharacters();
  }, []);

  // refresh when settings page saves
  useEffect(() => {
    const onUpd = () => setThresholdDb(loadVoiceSettings().thresholdDb);
    window.addEventListener("voice-settings-updated", onUpd);
    return () => window.removeEventListener("voice-settings-updated", onUpd);
  }, []);

  // keep header measured (responsive-safe)
  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.contentRect.height);
      }
    });
    ro.observe(headerRef.current);
    // initial measure
    setHeaderHeight(headerRef.current.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  const addCaption = (speaker: "user" | "ai", text: string) => {
    setCaptions(prev => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, speaker, text, time: new Date() },
    ])
  }
  const clearCaptions = () => setCaptions([])


  const currentThread = threads[activeCharacter] ?? [];
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentThread]);


  // 通話計時器
  useEffect(() => {
    if (isCallActive) {
      callTimer.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
      setCallDuration(0);
    }

    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, [isCallActive]);



  // 加載角色
  const loadCharacters = async () => {
    setIsLoading(true);
    setError("");
    try {
      const loadedCharacters = await CharacterAPI.fetchCharacters();
      setCharacters(loadedCharacters);
      if (loadedCharacters.length > 0 && !activeCharacter) {
        setActiveCharacter(loadedCharacters[0].id);
      }
    } catch (err) {
      setError("無法連接到服務器。請確保後端服務器正在運行在 http://localhost:8000");
    } finally {
      setIsLoading(false);
    }
  };

  const abortRef = useRef<AbortController | null>(null);

  // 發送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const now = new Date();
    const userMsg: Message = {
      id: `${now.getTime()}`,
      content: inputValue,
      sender: "user",
      timestamp: now,
      characterId: activeCharacter, // ensure you have threads per character
    };

    // 1) append user message
    setThreads((prev) => ({
      ...prev,
      [activeCharacter]: [...(prev[activeCharacter] ?? []), userMsg],
    }));
    addCaption("user", userMsg.content);

    // optional: show a typing placeholder bubble
    const typingId = `${now.getTime()}-typing`;
    setThreads((prev) => ({
      ...prev,
      [activeCharacter]: [
        ...(prev[activeCharacter] ?? []),
        {
          id: typingId,
          content: "",                // not used for typing
          kind: "typing",             // <-- key change
          sender: "ai",
          timestamp: new Date(),
          characterId: activeCharacter,
        },
      ],
    }));

    // clear input
    setInputValue("");

    // 2) call backend
    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const characterName = characters.find((c) => c.id === activeCharacter)?.name;
      const reply = await chatWithQwen({
        prompt: userMsg.content,
        character: characterName,
        character_json: JSON.stringify(characters.find((c) => c.id === activeCharacter)),
        signal: abortRef.current.signal,
      });

      // 3) replace typing with real message
      setThreads((prev) => {
        const list = prev[activeCharacter] ?? [];
        const withoutTyping = list.filter((m) => m.id !== typingId);
        return {
          ...prev,
          [activeCharacter]: [
            ...withoutTyping,
            {
              id: `${Date.now() + 1}`,
              content: reply || "(no content)",
              sender: "ai",
              timestamp: new Date(),
              characterId: activeCharacter,
            },
          ],
        };
      });
      addCaption("ai", reply || "(no content)");
    } catch (err: any) {
      // show error inside the thread
      setThreads((prev) => {
        const list = prev[activeCharacter] ?? [];
        const withoutTyping = list.filter((m) => m.id !== typingId);
        return {
          ...prev,
          [activeCharacter]: [
            ...withoutTyping,
            {
              id: `${Date.now() + 1}`,
              content: `⚠️ Qwen error: ${err?.message || err}`,
              sender: "ai",
              timestamp: new Date(),
              characterId: activeCharacter,
            },
          ],
        };
      });
      addCaption("ai", `⚠️ Qwen error: ${err?.message || err}`);
    } finally {
      abortRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 開始通話
  const startCall = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsCallActive(true);
      setIsVoicePanelOpen(true); // show overlay
      addCaption("ai", `📞 Voice channel opened with ${currentCharacter?.name ?? "AI"}.`);
    } catch (error) {
      console.error("Microphone access denied:", error);
      setError("需要麥克風權限才能進行語音通話!");
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setIsMuted(false);
    addCaption("ai", "📴 Call ended.");
    setIsVoicePanelOpen(false); // hide overlay
  };

  // 🔊 Hook: when call is active, capture turns
  const voice = useVoiceTurn({
    enabled: isCallActive,
    muted: isMuted,
    onTurn: async (wav) => {
      // Show a note in captions
      addCaption("user", "(voice) — sending audio…");

      const form = new FormData();
      form.append("audio", wav, "turn.wav");

      try {
        const r = await fetch("http://localhost:8787/api/turn", { method: "POST", body: form });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || r.statusText);

        // data.text should be ASR result (or your model's reply); for now, we treat as "user said" then ask Qwen
        const userSaid = data.text || "(no ASR)";
        addCaption("user", userSaid);

        // send to Qwen as chat message
        const now = new Date();
        const userMsg = {
          id: `${now.getTime()}`,
          content: userSaid,
          sender: "user" as const,
          timestamp: now,
          characterId: activeCharacter,
        };
        setThreads((prev) => ({
          ...prev,
          [activeCharacter]: [...(prev[activeCharacter] ?? []), userMsg],
        }));

        // typing bubble
        const typingId = `${Date.now()}-typing`;
        setThreads((prev) => ({
          ...prev,
          [activeCharacter]: [
            ...(prev[activeCharacter] ?? []),
            { id: typingId, content: "", kind: "typing" as const, sender: "ai" as const, timestamp: new Date(), characterId: activeCharacter },
          ],
        }));

        // model call
        const characterName = characters.find((c) => c.id === activeCharacter)?.name;
        const reply = await chatWithQwen({ 
          prompt: userSaid, 
          character: characterName, 
          character_json: JSON.stringify(characters.find((c) => c.id === activeCharacter)), 
        });

        // replace typing
        setThreads((prev) => {
          const list = prev[activeCharacter] ?? [];
          const withoutTyping = list.filter((m) => m.id !== typingId);
          return {
            ...prev,
            [activeCharacter]: [
              ...withoutTyping,
              { id: `${Date.now() + 1}`, content: reply || "(no content)", sender: "ai", timestamp: new Date(), characterId: activeCharacter },
            ],
          };
        });
        addCaption("ai", reply || "(no content)");
      } catch (err: any) {
        addCaption("ai", `⚠️ Turn error: ${err?.message || err}`);
      }
    },
  });


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 創建角色
  const createCharacter = async () => {
    if (!newCharacter.name?.trim()) {
      setError("角色名稱不能為空");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    const id = Date.now().toString();

    const characterData: Character = {
      id: id,
      name: newCharacter.name,
      personality: newCharacter.personality || "Friendly AI companion",
      description: newCharacter.description || "A lovely AI character",
      avatar: newCharacter.avatar || "✨",
      voice: newCharacter.voice || "female-cute",
      traits: newCharacter.traits || [],
      backstory: newCharacter.backstory || "A wonderful AI with lots to share!"
    };
    
    try {
      const createdCharacter = await CharacterAPI.createCharacter(characterData);
      if (createdCharacter) {
        setCharacters(prev => [...prev, createdCharacter]);
        resetNewCharacterForm();
        setIsCreatingCharacter(false);
        setError("");
      } else {
        setError("創建角色失敗");
      }
    } catch (err) {
      setError("創建角色時發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  // 刪除角色
  const deleteCharacter = async (characterId: string) => {
    if (characters.length <= 1) {
      setError("至少需要保留一個角色");
      return;
    }

    if (!confirm("確定要刪除這個角色嗎？")) return;

    setIsLoading(true);
    const success = await CharacterAPI.deleteCharacter(characterId);
    
    if (success) {
      setCharacters(prev => prev.filter(char => char.id !== characterId));
      if (activeCharacter === characterId) {
        const remainingChars = characters.filter(char => char.id !== characterId);
        if (remainingChars.length > 0) {
          setActiveCharacter(remainingChars[0].id);
        }
      }
    } else {
      setError("刪除角色失敗");
    }
    setIsLoading(false);
  };

  // 重置新角色表單
  const resetNewCharacterForm = () => {
    setNewCharacter({
      name: "",
      personality: "",
      description: "",
      avatar: "✨",
      voice: "female-cute",
      traits: [],
      backstory: ""
    });
    setNewTrait("");
  };

  // 添加特質
  const addTrait = () => {
    if (newTrait.trim() && newCharacter.traits) {
      setNewCharacter(prev => ({
        ...prev,
        traits: [...(prev.traits || []), newTrait.trim()]
      }));
      setNewTrait("");
    }
  };

  // 移除特質
  const removeTrait = (index: number) => {
    setNewCharacter(prev => ({
      ...prev,
      traits: prev.traits?.filter((_, i) => i !== index) || []
    }));
  };

  const currentCharacter = characters.find(char => char.id === activeCharacter);

  return (
    <div className="flex h-full">
      {/* Characters Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col shadow-soft">
        <div className="p-6 border-b border-border bg-gradient-cute">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-primary">
              ✨ Kawaii Chat ✨
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadCharacters}
              disabled={isLoading}
              className="hover:bg-primary/10"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Choose your AI companion!</p>
          {error && (
            <Alert className="mt-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="p-4 border-b border-border">
          <Dialog open={isCreatingCharacter} onOpenChange={setIsCreatingCharacter}>
            <DialogTrigger asChild>
              <Button 
                className="w-full bg-gradient-primary hover:scale-105 transition-all duration-300 shadow-cute font-medium"
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Character ✨
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create Kawaii Character
                </DialogTitle>
                <DialogDescription>
                  Design your perfect AI companion with personality! 💕
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="personality">Personality</TabsTrigger>
                  <TabsTrigger value="voice">Voice & Avatar</TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Character Name ✨</Label>
                    <Input
                      id="name"
                      value={newCharacter.name || ""}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter a cute name..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="personality">Personality Summary 💖</Label>
                    <Input
                      id="personality"
                      value={newCharacter.personality || ""}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, personality: e.target.value }))}
                      placeholder="Sweet and helpful companion..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description 🌸</Label>
                    <Textarea
                      id="description"
                      value={newCharacter.description || ""}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="A wonderful AI with..."
                      rows={3}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="personality" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Character Traits 🎀</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newCharacter.traits?.map((trait, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                          onClick={() => removeTrait(index)}
                        >
                          {trait} ×
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newTrait}
                        onChange={(e) => setNewTrait(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && addTrait()}
                        placeholder="Add a trait..."
                      />
                      <Button onClick={addTrait} variant="outline">
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="backstory">Backstory 📚</Label>
                    <Textarea
                      id="backstory"
                      value={newCharacter.backstory || ""}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, backstory: e.target.value }))}
                      placeholder="Tell their story..."
                      rows={4}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="voice" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar (Emoji) 🎭</Label>
                    <Input
                      id="avatar"
                      value={newCharacter.avatar || ""}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, avatar: e.target.value }))}
                      className="text-2xl"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="voice">Voice Type 🎵</Label>
                    <Select
                      value={newCharacter.voice || "female-cute"}
                      onValueChange={(value) => setNewCharacter(prev => ({ ...prev, voice: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female-cute">Female - Cute</SelectItem>
                        <SelectItem value="female-soft">Female - Soft</SelectItem>
                        <SelectItem value="female-energetic">Female - Energetic</SelectItem>
                        <SelectItem value="male-gentle">Male - Gentle</SelectItem>
                        <SelectItem value="neutral-mystical">Neutral - Mystical</SelectItem>
                        <SelectItem value="neutral-calm">Neutral - Calm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setIsCreatingCharacter(false);
                  resetNewCharacterForm();
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={createCharacter} 
                  className="bg-gradient-primary"
                  disabled={isLoading}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  {isLoading ? "Creating..." : "Create Character"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          {characters.map((character) => (
            <Card
              key={character.id}
              className={`mb-3 cursor-pointer transition-all duration-300 hover:shadow-cute hover:scale-105 ${
                activeCharacter === character.id 
                  ? "ring-2 ring-primary shadow-glow bg-gradient-primary/10" 
                  : "hover:bg-hover-accent"
              }`}
              onClick={() => setActiveCharacter(character.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{character.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg flex items-center gap-1">
                        {character.name}
                        {activeCharacter === character.id && <Star className="w-4 h-4 text-primary fill-primary" />}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCharacter(character.id);
                        }}
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 w-6 h-6 p-0"
                        disabled={characters.length <= 1}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{character.personality}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {character.traits.slice(0, 2).map((trait, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {characters.length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">
              <div className="text-4xl mb-4">🌸</div>
              <p>No characters found</p>
              <p className="text-xs mt-2">Create your first character!</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Overlay lives here so it only covers the chat column */}
        <VoiceCaptionOverlay
          open={isVoicePanelOpen}
          captions={captions}
          onClear={clearCaptions}
          topOffset={headerHeight}
          meterLevel={voice.meterLevel}
          db={voice.db}
          thresholdDb={thresholdDb}
        />
        {/* Chat Header */}
        <div ref={headerRef} className="h-20 bg-card border-b border-border flex items-center justify-between px-6 shadow-soft">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 ring-2 ring-primary/20">
              <AvatarFallback className="text-2xl bg-gradient-primary">
                {currentCharacter?.avatar || "✨"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2">
                {currentCharacter?.name || "Select a character"}
                <Heart className="w-4 h-4 text-red-400 fill-red-400" />
              </h3>
              <p className="text-sm text-muted-foreground">{currentCharacter?.personality}</p>
              {isCallActive && (
                <p className="text-xs text-primary font-medium">📞 Voice call active • {formatDuration(callDuration)}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isCallActive ? (
              <>
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setIsMuted(!isMuted)}
                  className="transition-all duration-200"
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={endCall}
                  className="transition-all duration-200"
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={startCall}
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white transition-all duration-200 hover:scale-105"
              >
                <Phone className="w-4 h-4 mr-2" />
                Voice Chat
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" title="Voice Settings">
              <Link to="/settings/voice" aria-label="Voice Settings">
                <Settings className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6 bg-gradient-secondary/30">
          <div className="space-y-4">
            {currentThread.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-soft transition-all duration-200 hover:scale-105 ${
                    message.sender === "user"
                      ? "bg-chat-bubble-user text-primary-foreground"
                      : "bg-chat-bubble text-foreground border border-primary/10"
                  }`}
                >
                  {message.kind === "typing" ? (
                    <TypingBubble />
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap font-medium">{message.content}</p>
                      <p className="text-xs opacity-70 mt-2 flex items-center gap-1">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-6 border-t border-border bg-card">
          <div className="flex gap-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... ✨"
              className="flex-1 bg-muted border-0 focus:ring-2 focus:ring-primary/50 rounded-xl font-medium"
              disabled={!currentCharacter}
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-gradient-primary hover:scale-110 transition-all duration-200 shadow-cute rounded-xl"
              disabled={!currentCharacter || !inputValue.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;