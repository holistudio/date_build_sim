"use client";

import { useEffect, useRef, useState } from "react";
import {
  useHelios,
  useHeliosChunkComplete,
  useHeliosState,
  type HeliosStateMessage,
} from "@reactor-models/helios";
import {
  SCENES,
  type Guide,
  type Scene,
  promptForCloseUp,
  promptForDirection,
  promptForScene,
} from "../lib/guide";
import { TopBar } from "./TopBar";
import { CommandError } from "./CommandError";
import { Stage } from "./Stage";
import { DialogueBox } from "./DialogueBox";
import { UserPrompt } from "./UserPrompt";

// How long the desk shot runs before the hard cut to the close-up, in
// Helios chunks (33 frames each). Counted from the model's own progress,
// so a slow GPU still shows the whole desk shot.
const DESK_CHUNKS = 3;

type Shot = "desk" | "closeUp";

// Whether a step's close-up image exists yet, by URL. Images arrive one
// step at a time, so a missing one just means "desk shot only".
const closeUpExists = new Map<string, Promise<boolean>>();
function hasCloseUp(scene: Scene): Promise<boolean> {
  const url = scene.build?.image;
  if (!url) return Promise.resolve(false);
  if (!closeUpExists.has(url)) {
    closeUpExists.set(
      url,
      fetch(url, { method: "HEAD" }).then(
        (r) => r.ok,
        () => false,
      ),
    );
  }
  return closeUpExists.get(url)!;
}

// The frame on screen right now, as a JPEG. The live stream is a WebRTC
// MediaStream, so drawing it to a canvas is allowed (no cross-origin
// taint).
async function grabVideoFrame(): Promise<Blob | null> {
  const video = document.querySelector<HTMLVideoElement>(
    "[data-live-video] video",
  );
  if (!video || !video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return new Promise((done) => canvas.toBlob(done, "image/jpeg", 0.92));
}

// The whole screen, laid out like the wireframe, top to bottom:
//
//   ┌ main_game ─────────────────────────────┐
//   │  live Helios video (or title screen)   │
//   └────────────────────────────────────────┘
//     ┌ main_game_actions ─────────────────┐
//     │ dialogue + Prev / Next choices     │
//     └────────────────────────────────────┘
//   ┌ user_prompt ───────────────────────────┐
//   └────────────────────────────────────────┘
//
// Nothing overlaps the video except the small chapter badge and part card.
//
// This component owns the one state snapshot, the guide position (scene +
// dialogue line) and the camera (which shot is on screen). The guide
// character is chosen once on the select screen and fixed from then on.
// The guide works without a connection: the text is always readable, and
// the video joins in once the session is live.
//
// Every step is two shots, each opened with a hard cut:
//   1. Desk shot: the guide seated at the worktable. The first one is
//      seeded by their (standing) sprite and they sit down; every later
//      one starts from a seated frame kept from that first shot.
//   2. Close-up: after DESK_CHUNKS chunks, the step's illustration
//      (public/steps/NN.jpg) on the build itself, hands only.
// A hard cut is `reset` → `setConditioning({ prompt, image })` → `start`:
// a fresh generation whose first frame is locked to the image
// (image_strength defaults to 1.0). A mid-stream `setImage` would only
// morph toward the new picture, not cut to it.
export function Game({ guide }: { guide: Guide }) {
  const {
    status,
    connect,
    uploadFile,
    setConditioning,
    setPrompt,
    start,
    reset,
  } = useHelios();
  const [snapshot, setSnapshot] = useState<HeliosStateMessage | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  // The player's own direction, while it is driving the video.
  const [direction, setDirection] = useState<string | null>(null);
  // True once the player has started the video on this connection. Kept
  // separately from `snapshot.started`, which drops to false for a moment
  // inside every hard cut.
  const [onAir, setOnAir] = useState(false);
  const [shot, setShot] = useState<Shot>("desk");
  const [cutting, setCutting] = useState(false);
  const [closeUpReady, setCloseUpReady] = useState(false);
  // Each cut takes a number; a cut that's been overtaken by a newer one
  // (the player pressed Next again) stops at its next await.
  const cutSeq = useRef(0);
  const chunksInShot = useRef(0);
  // A frame of the guide already seated at the worktable, grabbed from
  // the first desk shot as it cuts away. Later desk shots start from it
  // instead of the standing sprite, so the guide sits down only once.
  const deskKeyframe = useRef<Blob | null>(null);

  useHeliosState((msg) => setSnapshot(msg));

  // The SDK sends no final `state` when a session ends, so drop the old
  // snapshot or the UI keeps showing "live" after a disconnect.
  useEffect(() => {
    if (status !== "ready") {
      setSnapshot(null);
      setOnAir(false);
      setShot("desk");
      cutSeq.current++;
    }
  }, [status]);

  const ready = status === "ready";
  const live = ready && onAir;
  const scene = SCENES[sceneIndex];
  const isFirst = sceneIndex === 0;
  const isLast = sceneIndex === SCENES.length - 1;

  useEffect(() => {
    let current = true;
    setCloseUpReady(false);
    hasCloseUp(scene).then((ok) => current && setCloseUpReady(ok));
    return () => {
      current = false;
    };
  }, [scene]);

  async function cut(
    to: Shot,
    target: Scene,
    deskPrompt: string = promptForScene(target, guide),
  ) {
    if (!ready) return;
    // Leaving a desk shot that has played long enough for the guide to
    // have sat down? Keep that frame (once) for every later desk shot.
    const keepKeyframe =
      !deskKeyframe.current &&
      live &&
      !cutting &&
      shot === "desk" &&
      !direction &&
      chunksInShot.current >= DESK_CHUNKS;
    const seq = ++cutSeq.current;
    const stale = () => seq !== cutSeq.current;
    setShot(to);
    setCutting(true);
    try {
      if (keepKeyframe) deskKeyframe.current = await grabVideoFrame();

      let blob: Blob;
      let name: string;
      if (to === "desk" && deskKeyframe.current) {
        blob = deskKeyframe.current;
        name = `${guide.id}-seated.jpg`;
      } else {
        const url = to === "desk" ? guide.image : target.build?.image;
        if (!url) return;
        const res = await fetch(url);
        if (!res.ok && to === "closeUp") {
          // The image went missing since the check: stay on the desk.
          setShot("desk");
          setCloseUpReady(false);
        }
        if (!res.ok) return;
        blob = await res.blob();
        name = url.split("/").pop()!;
      }
      if (stale()) return;
      // Upload before the reset, so the screen holds its last frame for
      // as short a time as possible.
      const image = await uploadFile(blob, { name });
      if (stale()) return;
      const prompt =
        to === "desk" ? deskPrompt : promptForCloseUp(target.build!, guide);
      await reset();
      if (stale()) return;
      // A refusal resolves undefined; CommandError shows why. The reset
      // already stopped the video, so offer "Start the scene" again.
      if (!(await setConditioning({ prompt, image }))) {
        if (!stale()) setOnAir(false);
        return;
      }
      if (stale()) return;
      await start();
      chunksInShot.current = 0;
      setOnAir(true);
    } finally {
      if (!stale()) setCutting(false);
    }
  }

  // The desk shot's clock: cut to the close-up after DESK_CHUNKS chunks,
  // unless the player is directing the scene themselves.
  useHeliosChunkComplete(() => {
    chunksInShot.current++;
    if (
      live &&
      !cutting &&
      shot === "desk" &&
      !direction &&
      closeUpReady &&
      chunksInShot.current >= DESK_CHUNKS
    ) {
      cut("closeUp", scene);
    }
  });

  function goTo(index: number) {
    const next = Math.max(0, Math.min(SCENES.length - 1, index));
    setSceneIndex(next);
    setLineIndex(0);
    setDirection(null);
    if (live) cut("desk", SCENES[next]);
  }

  function advanceLine() {
    if (lineIndex < scene.lines.length - 1) setLineIndex(lineIndex + 1);
    else if (!isLast) goTo(sceneIndex + 1);
  }

  function startScene() {
    if (live || cutting) return;
    return cut(
      "desk",
      scene,
      direction ? promptForDirection(direction, scene, guide) : undefined,
    );
  }

  // The player's direction steers whatever shot is on screen (no cut) and
  // holds it there until they go back to the step.
  async function direct(text: string) {
    if (!ready) return;
    setDirection(text);
    const prompt = promptForDirection(text, scene, guide);
    if (live) await setPrompt({ prompt });
    else await cut("desk", scene, prompt);
  }

  function backToStep() {
    setDirection(null);
    if (live) cut("desk", scene);
  }

  // Visual-novel keys: Space / Enter advance the dialogue, arrows change
  // step. Ignored while typing or when a button has focus (Enter would
  // press it twice).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, button, a, [contenteditable]")) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        advanceLine();
      } else if (e.key === "ArrowRight") {
        goTo(sceneIndex + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(sceneIndex - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar snapshot={live && !cutting ? snapshot : null} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 lg:py-6">
        <CommandError />

        {/* main_game: sized so the textbox and prompt below still fit on
            screen (≈22rem of chrome under a 16:9 video). */}
        <section className="relative mx-auto w-full max-w-[max(28rem,calc((100svh-22rem)*16/9))] overflow-hidden rounded-3xl border-2 border-frame bg-panel shadow-[0_12px_40px_-16px_var(--color-shadow)]">
          <Stage
            scene={scene}
            sceneNumber={sceneIndex}
            sceneCount={SCENES.length - 1}
            live={live}
            status={status}
            direction={direction}
            shot={live ? (cutting ? "cutting" : shot) : null}
          />
        </section>

        {/* main_game_actions */}
        <div className="mt-2 sm:mx-4">
          <DialogueBox
            scene={scene}
            guide={guide}
            lineIndex={lineIndex}
            onAdvance={advanceLine}
            isLastScene={isLast}
          >
            <Choice disabled={isFirst} onClick={() => goTo(sceneIndex - 1)}>
              ◀ Previous Step
            </Choice>
            {status === "disconnected" && (
              <Choice primary onClick={() => connect()}>
                ✦ Connect to see it live
              </Choice>
            )}
            {ready && !live && (
              <Choice primary disabled={cutting} onClick={startScene}>
                {cutting ? "Starting…" : "✦ Start the scene"}
              </Choice>
            )}
            {live && closeUpReady && !direction && (
              <Choice
                disabled={cutting}
                onClick={() =>
                  cut(shot === "desk" ? "closeUp" : "desk", scene)
                }
              >
                {shot === "desk" ? "🎬 Close-up" : "🎬 Desk view"}
              </Choice>
            )}
            {direction && (
              <Choice onClick={backToStep}>↺ Back to the step</Choice>
            )}
            {isLast ? (
              <Choice onClick={() => goTo(0)}>↺ From the top</Choice>
            ) : (
              <Choice
                primary={live}
                onClick={() => goTo(sceneIndex + 1)}
              >
                Next Step ▶
              </Choice>
            )}
          </DialogueBox>
        </div>

        {/* user_prompt */}
        <UserPrompt guideName={guide.name} ready={ready} onDirect={direct} />
      </main>
    </div>
  );
}

function Choice({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        // Keep the click from also advancing the dialogue box behind it.
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-35 ${
        primary
          ? "border-blush bg-blush text-white shadow-[0_4px_0_var(--color-blush-deep)] hover:brightness-105"
          : "border-blush/60 bg-white/80 text-ink hover:border-blush hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}
