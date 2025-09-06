import { useEffect, useRef, useState } from "react";
import { loadVoiceSettings } from "@/lib/voiceSettings";

type Status = "idle" | "listening" | "speaking" | "sending" | "muted" | "stopped";

export function useVoiceTurn(opts: {
  enabled: boolean;
  onTurn: (wav: Blob) => Promise<void> | void;
  muted?: boolean;
}) {
  const { enabled, onTurn, muted = false } = opts;

  const [status, setStatus] = useState<Status>("idle");
  const [meterLevel, setMeterLevel] = useState(0);
  const [db, setDb] = useState(-80);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);

  const recChunksRef = useRef<Float32Array[]>([]);
  const speechMsRef = useRef(0);
  const silenceMsRef = useRef(0);
  const speakingRef = useRef(false);
  const settingsRef = useRef(loadVoiceSettings());

  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  const rmsToDb = (r: number) => 20 * Math.log10(clamp(r, 1e-6, 1));
  const rmsToLevel = (r: number) => clamp(r * 10, 0, 1);
  const SAMPLE_RATE = 16000;

  function resetTurn() {
    recChunksRef.current = [];
    speechMsRef.current = 0;
    silenceMsRef.current = 0;
    speakingRef.current = false;
  }

  function downsampleTo16k(float32: Float32Array, inRate: number, outRate = SAMPLE_RATE) {
    if (inRate === outRate) return float32;
    const ratio = inRate / outRate;
    const outLen = Math.floor(float32.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let sum = 0, count = 0;
      for (let j = start; j < end && j < float32.length; j++) { sum += float32[j]; count++; }
      out[i] = count ? (sum / count) : 0;
    }
    return out;
  }

  function floatTo16BitPCM(float32: Float32Array) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  function encodeWavFromFloat32(float32: Float32Array, sr = SAMPLE_RATE) {
    const pcm16 = floatTo16BitPCM(float32);
    const byteRate = sr * 2;
    const dataSize = pcm16.length * 2;
    const buf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buf);
    const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };

    write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE");
    write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, dataSize, true);
    let off = 44; for (let i = 0; i < pcm16.length; i++, off += 2) view.setInt16(off, pcm16[i], true);
    return new Blob([view], { type: "audio/wav" });
  }

  // Boot / teardown
  useEffect(() => {
    if (!enabled) {
      setStatus((s) => (s === "stopped" ? s : "idle"));
      try { procRef.current?.disconnect(); } catch {}
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setMeterLevel(0); setDb(-80); resetTurn();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
        audioCtxRef.current = audioCtx;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;

        const source = audioCtx.createMediaStreamSource(stream);
        const proc = audioCtx.createScriptProcessor(1024, 1, 1);
        procRef.current = proc;
        source.connect(proc);
        proc.connect(audioCtx.destination);

        setStatus(muted ? "muted" : "listening");
        resetTurn();

        proc.onaudioprocess = async (e) => {
          if (cancelled) return;

          // HARD MUTE: stop meter + VAD + buffers
          if (muted) {
            // Ensure context is suspended (handled by separate effect too)
            setMeterLevel(0);
            setDb(-80);
            resetTurn();
            // Do not process further
            return;
          }

          const inBuf = e.inputBuffer.getChannelData(0);

          // Meter
          let sum = 0;
          for (let i = 0; i < inBuf.length; i++) sum += inBuf[i] * inBuf[i];
          const rms = Math.sqrt(sum / inBuf.length);
          setMeterLevel(rmsToLevel(rms));
          setDb(rmsToDb(rms));

          // Buffer audio for the turn
          const down = downsampleTo16k(inBuf, audioCtx.sampleRate, 16000);
          recChunksRef.current.push(down);

          // VAD-ish
          const { thresholdDb, minSpeechMs, minSilenceMs } = settingsRef.current;
          const dbNow = rmsToDb(rms);
          const frameMs = (1000 * inBuf.length) / audioCtx.sampleRate;

          if (dbNow > thresholdDb) { speechMsRef.current += frameMs; silenceMsRef.current = 0; }
          else { silenceMsRef.current += frameMs; }

          if (!speakingRef.current && speechMsRef.current > minSpeechMs) {
            speakingRef.current = true;
            setStatus("speaking");
          }

          if (speakingRef.current && silenceMsRef.current > minSilenceMs) {
            // End of turn
            speakingRef.current = false;
            setStatus("sending");

            // concat
            const total = recChunksRef.current.reduce((a, b) => a + b.length, 0);
            const all = new Float32Array(total);
            let off = 0;
            for (const ch of recChunksRef.current) { all.set(ch, off); off += ch.length; }

            resetTurn();

            const wav = encodeWavFromFloat32(all, 16000);
            try {
              await onTurn(wav);
            } finally {
              if (!muted) setStatus("listening");
            }
          }
        };
      } catch (e) {
        console.error("Mic error:", e);
        setStatus("stopped");
      }
    })();

    return () => {
      cancelled = true;
      try { procRef.current?.disconnect(); } catch {}
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      setMeterLevel(0); setDb(-80); resetTurn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Suspend / resume audio graph when muted toggles
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) {
      // If no context (not enabled), just zero the meter/db
      setMeterLevel(0); setDb(-80);
      return;
    }

    if (muted) {
      // Stop processing completely
      resetTurn();
      setStatus("muted");
      setMeterLevel(0); setDb(-80);
      ctx.state !== "suspended" && ctx.suspend().catch(() => {});
    } else {
      // Resume processing
      ctx.state !== "running" && ctx.resume().catch(() => {});
      // If enabled, go back to listening
      setStatus("listening");
    }
  }, [muted]);

  return {
    status,
    meterLevel,
    db,
    reloadSettings: () => (settingsRef.current = loadVoiceSettings()),
  };
}
