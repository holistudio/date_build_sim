"use client";

import { useState } from "react";

const suggestions = (name: string) => [
  "Close-up on the hands",
  "View it from above",
  `${name} gives a thumbs up`,
  "Explain it on a whiteboard",
];

// user_prompt: the player's own direction for the scene. It becomes a
// live prompt (wrapped in the same art style and character by
// promptForDirection), and the Prev / Next / "Back to the step" choices
// return to the guide.
export function UserPrompt({
  guideName,
  ready,
  onDirect,
}: {
  guideName: string;
  ready: boolean;
  onDirect: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(value: string) {
    if (!ready || sending || !value.trim()) return;
    setSending(true);
    try {
      await onDirect(value.trim());
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border-2 border-ink/80 bg-white p-3 md:p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="direction" className="sr-only">
          Your direction
        </label>
        <textarea
          id="direction"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={2}
          disabled={!ready || sending}
          placeholder={
            ready
              ? `Tell ${guideName} what to show… (e.g. “zoom in on the RAM clips”)`
              : "Connect to direct the scene with your own prompt"
          }
          className="min-h-[3.25rem] flex-1 resize-none rounded-2xl border-2 border-blush/40 bg-blush-mist/40 px-3 py-2 text-[15px] text-ink placeholder:text-ink/40 focus:border-blush focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!ready || sending || !text.trim()}
          className="rounded-2xl bg-ink px-5 py-2 text-sm font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-35"
        >
          {sending ? "Sending…" : "Direct ✦"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions(guideName).map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={!ready || sending}
            className="rounded-full border border-ink/15 px-2.5 py-0.5 text-xs font-semibold text-ink/70 hover:border-blush hover:text-blush-deep disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
