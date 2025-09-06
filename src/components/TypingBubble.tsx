import { memo } from "react";

export const TypingBubble = memo(function TypingBubble() {
  // Accessible: announce once, but don't spam screen readers.
  return (
    <div
        className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-chat-bubble border border-primary/10 shadow-soft"
        role="status"
        aria-live="polite"
        aria-label="AI is typing"
        >
        <span className="sr-only">AI is typing…</span>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
    </div>
  );
});
