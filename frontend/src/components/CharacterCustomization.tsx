import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, User } from "lucide-react";

interface Character {
  id: string;
  name: string;
  personality: string;
  description: string;
  avatar: string;
  voice: string;
  traits: string[];
  backstory: string;
}

const CharacterCustomization = () => {
  const [characters, setCharacters] = useState<Character[]>([
    {
      id: "1",
      name: "Luna",
      personality: "Helpful and empathetic AI assistant",
      description: "A caring and knowledgeable companion who loves to help with any task.",
      avatar: "🌙",
      voice: "female-calm",
      traits: ["Helpful", "Empathetic", "Patient", "Knowledgeable"],
      backstory: "Luna was designed to be the perfect assistant, with deep understanding of human emotions and needs."
    },
    {
      id: "2",
      name: "Alex",
      personality: "Creative and artistic thinker",
      description: "An imaginative AI with a passion for creative writing and storytelling.",
      avatar: "✨",
      voice: "neutral-energetic",
      traits: ["Creative", "Artistic", "Imaginative", "Inspiring"],
      backstory: "Alex draws inspiration from countless stories and creative works to help others express their ideas."
    }
  ]);
  // test
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(characters[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [newTrait, setNewTrait] = useState("");

  const handleSaveCharacter = () => {
    if (selectedCharacter) {
      setCharacters(prev => 
        prev.map(char => 
          char.id === selectedCharacter.id ? selectedCharacter : char
        )
      );
      setIsEditing(false);
    }
  };

  const handleCreateCharacter = () => {
    const newCharacter: Character = {
      id: Date.now().toString(),
      name: "New Character",
      personality: "",
      description: "",
      avatar: "🤖",
      voice: "neutral-calm",
      traits: [],
      backstory: ""
    };
    setCharacters(prev => [...prev, newCharacter]);
    setSelectedCharacter(newCharacter);
    setIsEditing(true);
  };

  const handleDeleteCharacter = (id: string) => {
    setCharacters(prev => prev.filter(char => char.id !== id));
    if (selectedCharacter?.id === id) {
      setSelectedCharacter(characters[0] || null);
    }
  };

  const addTrait = () => {
    if (newTrait.trim() && selectedCharacter) {
      setSelectedCharacter({
        ...selectedCharacter,
        traits: [...selectedCharacter.traits, newTrait.trim()]
      });
      setNewTrait("");
    }
  };

  const removeTrait = (index: number) => {
    if (selectedCharacter) {
      setSelectedCharacter({
        ...selectedCharacter,
        traits: selectedCharacter.traits.filter((_, i) => i !== index)
      });
    }
  };

  const updateCharacterField = (field: keyof Character, value: string) => {
    if (selectedCharacter) {
      setSelectedCharacter({
        ...selectedCharacter,
        [field]: value
      });
    }
  };

  return (
    <div className="h-full flex">
      {/* Character List */}
      <div className="w-80 bg-card border-r border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Characters</h2>
          <Button onClick={handleCreateCharacter} size="sm" className="bg-gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            New
          </Button>
        </div>

        <div className="space-y-3">
          {characters.map((character) => (
            <Card
              key={character.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-subtle ${
                selectedCharacter?.id === character.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedCharacter(character)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{character.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{character.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{character.personality}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCharacter(character.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Character Editor */}
      <div className="flex-1 p-6">
        {selectedCharacter ? (
          <Tabs defaultValue="basic" className="h-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="personality">Personality</TabsTrigger>
                <TabsTrigger value="voice">Voice & Avatar</TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
                {isEditing && (
                  <Button
                    onClick={handleSaveCharacter}
                    className="bg-gradient-primary"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Configure the fundamental aspects of your character</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Character Name</Label>
                    <Input
                      id="name"
                      value={selectedCharacter.name}
                      onChange={(e) => updateCharacterField("name", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="personality">Personality Summary</Label>
                    <Input
                      id="personality"
                      value={selectedCharacter.personality}
                      onChange={(e) => updateCharacterField("personality", e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={selectedCharacter.description}
                      onChange={(e) => updateCharacterField("description", e.target.value)}
                      disabled={!isEditing}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="personality" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personality Traits</CardTitle>
                  <CardDescription>Define the character's traits and backstory</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Character Traits</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedCharacter.traits.map((trait, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => isEditing && removeTrait(index)}
                        >
                          {trait}
                          {isEditing && " ×"}
                        </Badge>
                      ))}
                    </div>
                    {isEditing && (
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
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="backstory">Backstory</Label>
                    <Textarea
                      id="backstory"
                      value={selectedCharacter.backstory}
                      onChange={(e) => updateCharacterField("backstory", e.target.value)}
                      disabled={!isEditing}
                      rows={4}
                      placeholder="Tell the character's story..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voice" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Voice & Avatar</CardTitle>
                  <CardDescription>Customize appearance and voice settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="avatar">Avatar (Emoji)</Label>
                    <Input
                      id="avatar"
                      value={selectedCharacter.avatar}
                      onChange={(e) => updateCharacterField("avatar", e.target.value)}
                      disabled={!isEditing}
                      className="text-2xl"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="voice">Voice Type</Label>
                    <Select
                      value={selectedCharacter.voice}
                      onValueChange={(value) => updateCharacterField("voice", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female-calm">Female - Calm</SelectItem>
                        <SelectItem value="female-energetic">Female - Energetic</SelectItem>
                        <SelectItem value="male-calm">Male - Calm</SelectItem>
                        <SelectItem value="male-energetic">Male - Energetic</SelectItem>
                        <SelectItem value="neutral-calm">Neutral - Calm</SelectItem>
                        <SelectItem value="neutral-energetic">Neutral - Energetic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Character Selected</h3>
              <p className="text-muted-foreground mb-4">Select a character from the list to edit</p>
              <Button onClick={handleCreateCharacter} className="bg-gradient-primary">
                Create New Character
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterCustomization;