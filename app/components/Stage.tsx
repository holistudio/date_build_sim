"use client";

import { useState } from "react";
import Image from "next/image";
import type { Scene } from "../lib/guide";
import { Video } from "./Video";

// The picture half of main_game. Before the session is live this is a
// pastel title screen that says what to do next; once live, the Helios
// stream fades in over it. The chapter badge, the player's direction and
// the real photo of the part sit on top either way.
export function Stage({
  scene,
  sceneNumber,
  sceneCount,
  live,
  status,
  direction,
  shot,
}: {
  scene: Scene;
  sceneNumber: number;
  sceneCount: number;
  live: boolean;
  status: string;
  direction: string | null;
  /** Which camera is on air, while live. */
  shot: "desk" | "closeUp" | "cutting" | null;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-backdrop">
      <TitleScreen status={status} hidden={live} />
      <Video visible={live} />

      <div className="absolute left-3 top-3 flex max-w-[60%] flex-col items-start gap-2 md:left-4 md:top-4">
        <div className="rounded-full border-2 border-white/80 bg-ink/75 px-3 py-1 text-xs font-bold text-white backdrop-blur md:text-sm">
          <span className="text-blush-soft">{scene.chapter}</span>
          <span className="mx-1.5 opacity-50">·</span>
          {scene.title}
        </div>
        <Progress current={sceneNumber} total={sceneCount} />
        {shot && (
          <div className="rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur md:text-[11px]">
            {SHOT_LABEL[shot]}
          </div>
        )}
        {direction && (
          <div className="line-clamp-2 rounded-xl border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur md:text-xs">
            ✎ Your direction: {direction}
          </div>
        )}
      </div>

      {scene.part && <PartCard key={scene.part.src} part={scene.part} />}
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1" aria-label={`Scene ${current} of ${total}`}>
      {Array.from({ length: total + 1 }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? "w-4 bg-blush"
              : i < current
                ? "w-1.5 bg-white"
                : "w-1.5 bg-white/40"
          }`}
        />
      ))}
    </div>
  );
}

// The real product photo, like an "item get" card. Click to enlarge.
function PartCard({ part }: { part: NonNullable<Scene["part"]> }) {
  const [big, setBig] = useState(false);
  return (
    <button
      onClick={() => setBig(!big)}
      title={big ? "Shrink" : "Enlarge"}
      className={`absolute right-3 top-3 rotate-2 rounded-xl border-2 border-white bg-white p-1.5 shadow-lg transition-all hover:rotate-0 md:right-4 md:top-4 ${
        big ? "w-56 md:w-80" : "w-20 md:w-36"
      }`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white">
        <Image
          src={part.src}
          alt={part.label}
          fill
          sizes="320px"
          className="object-contain"
        />
      </div>
      <div className="mt-1 truncate text-center text-[10px] font-bold text-ink md:text-xs">
        {part.label}
      </div>
    </button>
  );
}

const SHOT_LABEL = {
  desk: "🎥 Desk",
  closeUp: "🎥 Close-up",
  cutting: "✂ Cut…",
} as const;

const HINT: Record<string, string> = {
  disconnected: "Press “Connect to see it live” to bring the workshop to life, or just read along below.",
  connecting: "Connecting to Reactor…",
  waiting: "Waiting for a GPU… this can take a little while.",
  ready: "Connected! Press “Start the scene” to begin.",
};

function TitleScreen({ status, hidden }: { status: string; hidden: boolean }) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <div className="petals" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>
      <div className="relative flex h-full flex-col items-center justify-start px-6 pt-[14%] text-center md:pt-[10%]">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-blush-deep md:text-sm">
          Build Route ♡
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-ink md:text-5xl">
          Great Intel Gaming Build
        </h2>
        <p className="mt-3 max-w-md text-xs font-semibold text-ink/70 md:text-base">
          {HINT[status] ?? HINT.disconnected}
        </p>
      </div>
    </div>
  );
}
