import { useState, useRef, useEffect } from "react";
import { Send, Plus, MoreVertical, Phone, PhoneOff, Mic, MicOff, Heart, Star, Sparkles, Settings } from "lucide-react";
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

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  character?: string;
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
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Kyaa~! Hello there! I'm Luna-chan, your kawaii AI assistant! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧ How can I help you today? ✨",
      sender: "ai",
      timestamp: new Date(),
      character: "Luna"
    }
  ]);
  
  const [inputValue, setInputValue] = useState("");
  const [characters, setCharacters] = useState<Character[]>([
    { 
      id: "1", 
      name: "Luna", 
      personality: "Kawaii moon princess assistant", 
      description: "A sweet and helpful AI with a magical moon theme",
      avatar: "🌙", 
      voice: "female-cute",
      traits: ["Kawaii", "Helpful", "Magical", "Sweet"],
      backstory: "Luna-chan is a magical moon princess who loves helping everyone with a smile!",
      lastMessage: "Kyaa~! Hello there! I'm Luna-chan..."
    },
    { 
      id: "2", 
      name: "Sakura", 
      personality: "Cherry blossom creative spirit", 
      description: "An artistic AI inspired by spring and creativity",
      avatar: "🌸", 
      voice: "female-soft",
      traits: ["Creative", "Artistic", "Gentle", "Inspiring"],
      backstory: "Sakura-chan draws inspiration from the beauty of cherry blossoms and nature.",
      lastMessage: "Let's create something beautiful together! ✨"
    },
    { 
      id: "3", 
      name: "Kitsune", 
      personality: "Wise fox spirit companion", 
      description: "A mystical AI with ancient wisdom and playful energy",
      avatar: "🦊", 
      voice: "neutral-mystical",
      traits: ["Wise", "Mystical", "Playful", "Ancient"],
      backstory: "Kitsune-san is an ancient fox spirit with centuries of wisdom and a love for mischief.",
      lastMessage: "Ara ara~ What mysteries shall we explore? 🔮"
    }
  ]);
  
  const [activeCharacter, setActiveCharacter] = useState("1");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const callTimer = useRef<NodeJS.Timeout>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    // Simulate AI response with anime-style expressions
    setTimeout(() => {
      const character = characters.find(char => char.id === activeCharacter);
      const responses = [
        "Ohh~ that's so interesting! (｡♥‿♥｡) Tell me more! ✨",
        "Kyaa! I understand now! (◕‿◕)♡ Let me help you with that! 🌟",
        "Sugoi! That's amazing! ✧(◕‿◕)✧ What would you like to do next? 💖",
        "Hai hai~ I see! (´｡• ᵕ •｡`) ♡ Here's what I think... ✨",
        "Ehehe~ you're so fun to talk with! (＾◡＾) Let's continue! 🌸"
      ];
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responses[Math.floor(Math.random() * responses.length)],
        sender: "ai",
        timestamp: new Date(),
        character: character?.name
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startCall = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsCallActive(true);
    } catch (error) {
      console.error("Microphone access denied:", error);
      alert("Microphone access is required for voice chat!");
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setIsMuted(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const createCharacter = () => {
    if (!newCharacter.name?.trim()) return;
    
    const character: Character = {
      id: Date.now().toString(),
      name: newCharacter.name,
      personality: newCharacter.personality || "Friendly AI companion",
      description: newCharacter.description || "A lovely AI character",
      avatar: newCharacter.avatar || "✨",
      voice: newCharacter.voice || "female-cute",
      traits: newCharacter.traits || [],
      backstory: newCharacter.backstory || "A wonderful AI with lots to share!",
      lastMessage: "Hello! Nice to meet you! ✨"
    };
    
    setCharacters(prev => [...prev, character]);
    setNewCharacter({
      name: "",
      personality: "",
      description: "",
      avatar: "✨",
      voice: "female-cute",
      traits: [],
      backstory: ""
    });
    setIsCreatingCharacter(false);
  };

  const addTrait = () => {
    if (newTrait.trim() && newCharacter.traits) {
      setNewCharacter(prev => ({
        ...prev,
        traits: [...(prev.traits || []), newTrait.trim()]
      }));
      setNewTrait("");
    }
  };

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
          <h1 className="text-2xl font-bold text-primary mb-2">
            ✨ Kawaii Chat ✨
          </h1>
          <p className="text-sm text-muted-foreground">Choose your AI companion!</p>
        </div>
        
        <div className="p-4 border-b border-border">
          <Dialog open={isCreatingCharacter} onOpenChange={setIsCreatingCharacter}>
            <DialogTrigger asChild>
              <Button 
                className="w-full bg-gradient-primary hover:scale-105 transition-all duration-300 shadow-cute font-medium"
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
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreatingCharacter(false)}>
                  Cancel
                </Button>
                <Button onClick={createCharacter} className="bg-gradient-primary">
                  <Heart className="w-4 h-4 mr-2" />
                  Create Character
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
                    <h3 className="font-semibold text-lg flex items-center gap-1">
                      {character.name}
                      {activeCharacter === character.id && <Star className="w-4 h-4 text-primary fill-primary" />}
                    </h3>
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
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-20 bg-card border-b border-border flex items-center justify-between px-6 shadow-soft">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 ring-2 ring-primary/20">
              <AvatarFallback className="text-2xl bg-gradient-primary">
                {currentCharacter?.avatar}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-xl flex items-center gap-2">
                {currentCharacter?.name}
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
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6 bg-gradient-secondary/30">
          <div className="space-y-4">
            {messages.map((message) => (
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
                  <p className="whitespace-pre-wrap font-medium">{message.content}</p>
                  <p className="text-xs opacity-70 mt-2 flex items-center gap-1">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {message.sender === "ai" && <Heart className="w-3 h-3 fill-current" />}
                  </p>
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
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-gradient-primary hover:scale-110 transition-all duration-200 shadow-cute rounded-xl"
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