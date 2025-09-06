import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loadVoiceSettings, saveVoiceSettings, VoiceSettings } from "@/lib/voiceSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export default function VoiceSettingsPage() {
  const [cfg, setCfg] = useState<VoiceSettings>(loadVoiceSettings());
  const navigate = useNavigate();

  useEffect(() => { saveVoiceSettings(cfg); }, [cfg]);

  const broadcast = () => window.dispatchEvent(new Event("voice-settings-updated"));

  const handleSave = () => {
    saveVoiceSettings(cfg);
    broadcast();
    navigate(-1);    // 👈 go back to the previous page (chat)
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Voice Settings</h1>

      <Card>
        <CardHeader><CardTitle>Endpointing</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Threshold (dB)</Label>
            <div className="flex items-center gap-3">
              <Slider
                value={[cfg.thresholdDb]}
                min={-80} max={0} step={1}
                onValueChange={([v]) => setCfg({ ...cfg, thresholdDb: v })}
                className="flex-1"
              />
              <Input
                className="w-24"
                type="number"
                value={cfg.thresholdDb}
                onChange={(e) => setCfg({ ...cfg, thresholdDb: Number(e.target.value) })}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Lower (e.g. -50) = more sensitive; Higher (e.g. -30) = less sensitive.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Speech (ms)</Label>
              <Input
                type="number"
                value={cfg.minSpeechMs}
                onChange={(e) => setCfg({ ...cfg, minSpeechMs: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Min Silence (ms)</Label>
              <Input
                type="number"
                value={cfg.minSilenceMs}
                onChange={(e) => setCfg({ ...cfg, minSilenceMs: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline"
              onClick={() => setCfg({ thresholdDb: -40, minSpeechMs: 600, minSilenceMs: 2000 })}>
              Reset Defaults
            </Button>
            <Button onClick={handleSave} className="bg-gradient-primary">
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}