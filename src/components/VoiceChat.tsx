import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CallStatus {
  isConnected: boolean;
  isRecording: boolean;
  isMuted: boolean;
  duration: number;
}

const VoiceChat = () => {
  const [callStatus, setCallStatus] = useState<CallStatus>({
    isConnected: false,
    isRecording: false,
    isMuted: false,
    duration: 0
  });
  
  const [selectedCharacter, setSelectedCharacter] = useState("Luna");
  const [volume, setVolume] = useState([80]);
  const [transcript, setTranscript] = useState<string[]>([]);
  const callTimer = useRef<NodeJS.Timeout>();

  const characters = [
    { name: "Luna", avatar: "🌙", voice: "female-calm" },
    { name: "Alex", avatar: "✨", voice: "neutral-energetic" },
    { name: "Sage", avatar: "🧠", voice: "male-calm" }
  ];

  useEffect(() => {
    if (callStatus.isConnected) {
      callTimer.current = setInterval(() => {
        setCallStatus(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    } else {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    }

    return () => {
      if (callTimer.current) {
        clearInterval(callTimer.current);
      }
    };
  }, [callStatus.isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCall = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setCallStatus(prev => ({ ...prev, isConnected: true, duration: 0 }));
      setTranscript(["📞 Call started with " + selectedCharacter]);
    } catch (error) {
      console.error("Microphone access denied:", error);
      alert("Microphone access is required for voice chat.");
    }
  };

  const endCall = () => {
    setCallStatus({
      isConnected: false,
      isRecording: false,
      isMuted: false,
      duration: 0
    });
    setTranscript([]);
  };

  const toggleMute = () => {
    setCallStatus(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleRecording = () => {
    setCallStatus(prev => ({ ...prev, isRecording: !prev.isRecording }));
    
    if (!callStatus.isRecording) {
      // Simulate speech recognition
      setTimeout(() => {
        setTranscript(prev => [...prev, "🎤 You: Hello, how are you today?"]);
        setTimeout(() => {
          setTranscript(prev => [...prev, `🤖 ${selectedCharacter}: I'm doing great! Thanks for asking. How can I help you today?`]);
        }, 1500);
      }, 2000);
    }
  };

  const currentCharacter = characters.find(char => char.name === selectedCharacter);

  return (
    <div className="h-full p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Voice Chat</h1>
        <p className="text-muted-foreground">Have a natural conversation with AI characters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Interface */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Voice Call</CardTitle>
            <CardDescription>
              {callStatus.isConnected 
                ? `Connected with ${selectedCharacter} • ${formatDuration(callStatus.duration)}`
                : "Start a voice conversation"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Character Selection */}
            {!callStatus.isConnected && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Character</label>
                <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {characters.map((char) => (
                      <SelectItem key={char.name} value={char.name}>
                        <div className="flex items-center gap-2">
                          <span>{char.avatar}</span>
                          <span>{char.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Character Avatar */}
            <div className="flex justify-center">
              <div className={`relative ${callStatus.isConnected ? 'animate-pulse' : ''}`}>
                <Avatar className="w-32 h-32">
                  <AvatarFallback className="text-4xl bg-gradient-primary">
                    {currentCharacter?.avatar}
                  </AvatarFallback>
                </Avatar>
                {callStatus.isConnected && (
                  <div className="absolute -bottom-2 -right-2">
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      Live
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Call Controls */}
            <div className="flex justify-center gap-4">
              {!callStatus.isConnected ? (
                <Button
                  onClick={startCall}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Start Call
                </Button>
              ) : (
                <>
                  <Button
                    variant={callStatus.isMuted ? "destructive" : "outline"}
                    size="lg"
                    onClick={toggleMute}
                  >
                    {callStatus.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                  
                  <Button
                    variant={callStatus.isRecording ? "default" : "outline"}
                    size="lg"
                    onClick={toggleRecording}
                    className={callStatus.isRecording ? "bg-red-600 hover:bg-red-700 animate-pulse" : ""}
                  >
                    {callStatus.isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>
                  
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={endCall}
                  >
                    <PhoneOff className="w-5 h-5" />
                  </Button>
                </>
              )}
            </div>

            {/* Volume Control */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Volume2 className="w-4 h-4" />
                <span className="text-sm w-12">{volume[0]}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Transcript */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Live Transcript</CardTitle>
            <CardDescription>Real-time conversation transcription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {transcript.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Transcript will appear here during the call</p>
                </div>
              ) : (
                transcript.map((message, index) => (
                  <div key={index} className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">{message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Chat Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">🎤 Clear Audio</h4>
              <p className="text-muted-foreground">Use a good microphone and speak clearly for best results.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🔊 Volume Control</h4>
              <p className="text-muted-foreground">Adjust the volume slider to set comfortable audio levels.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">⚡ Real-time</h4>
              <p className="text-muted-foreground">Experience natural conversations with minimal latency.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceChat;