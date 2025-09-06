import { useState, useRef, useEffect } from "react";
import { Send, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  character?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  character: string;
  avatar?: string;
  lastMessage?: string;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm Luna, your AI assistant. How can I help you today?",
      sender: "ai",
      timestamp: new Date(),
      character: "Luna"
    }
  ]);
  
  const [inputValue, setInputValue] = useState("");
  const [chatRooms] = useState<ChatRoom[]>([
    { id: "1", name: "Luna", character: "Helpful Assistant", avatar: "🌙", lastMessage: "Hello! I'm Luna..." },
    { id: "2", name: "Alex", character: "Creative Writer", avatar: "✨", lastMessage: "Let's write something amazing!" },
    { id: "3", name: "Sage", character: "Philosophy Expert", avatar: "🧠", lastMessage: "What deep questions shall we explore?" }
  ]);
  
  const [activeRoom, setActiveRoom] = useState("1");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I understand your message. This is a simulated response from the AI character. In a real implementation, this would connect to an LLM API.",
        sender: "ai",
        timestamp: new Date(),
        character: chatRooms.find(room => room.id === activeRoom)?.name
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

  return (
    <div className="flex h-full">
      {/* Chat Rooms Sidebar */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Chat Rooms</h2>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          {chatRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setActiveRoom(room.id)}
              className={`p-4 rounded-lg mb-2 cursor-pointer transition-all duration-200 hover:bg-hover-accent ${
                activeRoom === room.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{room.avatar}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{room.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{room.character}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">{room.lastMessage}</p>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback>{chatRooms.find(room => room.id === activeRoom)?.avatar}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{chatRooms.find(room => room.id === activeRoom)?.name}</h3>
              <p className="text-sm text-muted-foreground">{chatRooms.find(room => room.id === activeRoom)?.character}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.sender === "user"
                      ? "bg-chat-bubble-user text-primary-foreground"
                      : "bg-chat-bubble text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-6 border-t border-border">
          <div className="flex gap-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 bg-muted border-0 focus:ring-2 focus:ring-primary/50"
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
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