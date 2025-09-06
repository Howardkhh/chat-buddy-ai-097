// src/components/VoiceCaptionOverlay.tsx
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface Caption {
  id: string
  speaker: "user" | "ai"
  text: string
  time: Date
}

interface Props {
  open: boolean
  captions: Caption[]
  onClear?: () => void
  topOffset?: number
  meterLevel?: number
  db?: number;
  thresholdDb?: number;
}

export default function VoiceCaptionOverlay({ open, captions, onClear, topOffset = 0, meterLevel = 0, db = -80, thresholdDb = -40 }: Props) {
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // helpers to place the red indicator
  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  const dbToRms = (val: number) => Math.pow(10, val / 20);
  const rmsToLevel = (r: number) => clamp(r * 10, 0, 1);

  const thrPct = Math.round(rmsToLevel(dbToRms(thresholdDb)) * 100); // % from left

  return (
    <div className="pointer-events-none absolute left-0 right-0 z-50"
         style={{ top: topOffset, height: `calc(100% - ${topOffset}px)` }}
         aria-hidden={!open}>
      <div className={["w-full h-full","border-t border-border bg-card/95 backdrop-blur",
                       open ? "pointer-events-auto opacity-100" : "opacity-0 pointer-events-none",
                       "transition-opacity duration-300"].join(" ")}
           role="region" aria-live="polite" aria-label="Live captions">

        {/* Header with meter + needle + readout */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="flex items-center gap-3">
            <span className="font-semibold">Live Captions</span>

            {/* Meter container */}
            <div className="relative h-2 w-40 bg-muted rounded overflow-hidden shadow-inner" title="Input level">
              {/* fill bar */}
              <div className="h-full bg-green-500 transition-[width] duration-75"
                   style={{ width: `${Math.round(meterLevel * 100)}%` }} />
              {/* red needle at threshold */}
              <div
                className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-red-500"
                style={{ left: `calc(${thrPct}% - 1px)` }}
                aria-label="Threshold"
              />
            </div>

            {/* dB label */}
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round(db)} dB
            </span>

            {/* threshold label */}
            <span className="text-xs text-red-600 tabular-nums">
              (thr {Math.round(thresholdDb)} dB)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClear} className="pointer-events-auto">Clear</Button>
          </div>
        </div>

        {/* Body (unchanged) */}
        <ScrollArea className="h-[calc(100%-48px)] px-4 py-3">
          {captions.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">The conversation captions will appear here…</div>
          ) : (
            <div className="space-y-3">
              {captions.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <Badge variant={c.speaker === "user" ? "default" : "secondary"}>
                    {c.speaker === "user" ? "You" : "AI"}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{c.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{fmt(c.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}