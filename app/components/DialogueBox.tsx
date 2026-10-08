"use client";

import { useEffect, useMemo, useState } from "react";
import { lineFor, type Guide, type Scene } from "../lib/guide";

const CHARS_PER_TICK = 2;
const TICK_MS = 16;

// The visual-novel textbox: name plate, typewriter dialogue, and the
// choice buttons (passed as children). Clicking the box while text is
// still typing finishes the line; clicking again advances.
export function DialogueBox({
  scene,
  guide,
  lineIndex,
  onAdvance,
  isLastScene,
  children,
}: {
  scene: Scene;
  guide: Guide;
  lineIndex: number;
  onAdvance: () => void;
  isLastScene: boolean;
  children: React.ReactNode;
}) {
  const line = lineFor(scene.lines[lineIndex], guide);
  const segments = useMemo(() => parseBold(line), [line]);
  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= total) {
          clearInterval(id);
          return n;
        }
        return n + CHARS_PER_TICK;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [line, total]);

  const typing = shown < total;
  const atEnd = lineIndex === scene.lines.length - 1;

  return (
    <div
      onClick={() => (typing ? setShown(total) : onAdvance())}
      className="relative cursor-pointer select-none rounded-2xl border-2 border-blush/70 bg-gradient-to-b from-white to-blush-mist px-4 pb-3 pt-6 shadow-[0_8px_30px_-10px_var(--color-shadow)] md:px-6"
    >
      <div
        style={{ backgroundColor: guide.color }}
        className="absolute -top-4 left-4 rounded-full border-2 border-white px-4 py-0.5 text-sm font-extrabold tracking-wide text-white shadow transition-colors md:left-6"
      >
        {guide.name}
      </div>

      <p className="min-h-[4.875em] text-[15px] leading-relaxed text-ink md:text-lg">
        {renderUpTo(segments, shown)}
        {!typing && (
          <span className="ml-1 inline-block animate-bounce text-blush">
            {atEnd && isLastScene ? "♡" : "▼"}
          </span>
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {children}
        <span className="ml-auto text-[11px] font-semibold text-ink/50">
          {lineIndex + 1}/{scene.lines.length}
          <span className="hidden md:inline"> · click or Space to continue</span>
        </span>
      </div>
    </div>
  );
}

type Segment = { text: string; bold: boolean };

function parseBold(line: string): Segment[] {
  return line
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}

function renderUpTo(segments: Segment[], count: number) {
  let left = count;
  return segments.map((s, i) => {
    if (left <= 0) return null;
    const text = s.text.slice(0, left);
    left -= s.text.length;
    return s.bold ? (
      <strong key={i} className="font-extrabold text-blush-deep">
        {text}
      </strong>
    ) : (
      <span key={i}>{text}</span>
    );
  });
}
