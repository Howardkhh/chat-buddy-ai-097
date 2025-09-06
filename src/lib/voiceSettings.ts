export type VoiceSettings = {
  thresholdDb: number;   // e.g. -40 dB
  minSpeechMs: number;   // e.g. 200 ms
  minSilenceMs: number;  // e.g. 700 ms
};

const KEY = "voice.settings.v1";

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { thresholdDb: -40, minSpeechMs: 200, minSilenceMs: 700 };
}

export function saveVoiceSettings(v: VoiceSettings) {
  localStorage.setItem(KEY, JSON.stringify(v));
}
