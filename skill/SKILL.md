---
name: building-helios-frontends
description: Extend the PC Build Route Helios app — add new controls, scenes, guides, knobs, image flows, or features on top of `@reactor-models/helios` (pinned to ^1.0.1, on `@reactor-team/js-sdk` 3.x) without breaking the patterns the existing code already uses. Covers the SDK's connection / commands / messages model, whether a result arrives on the awaited call or on a subscription, the phase-based UI architecture, the state snapshot pattern, the atomic `setConditioning({ prompt, image })` command and the hard-cut pattern built on it, mid-stream prompt switching, the scene content in `app/lib/guide.ts`, and prompt design rules for smooth continuous video generation.
---

# Building on this Helios app

You've cloned this repo and now you want to extend it — a new control, a new scene, a new guide, a model knob, a different UX. This guide explains the Helios SDK patterns the existing code uses and the rules to follow so your additions feel native instead of bolted on.

The app in one paragraph: `app/HeliosApp.tsx` mounts `<HeliosProvider>` after the player picks a guide. `app/components/Game.tsx` owns the one state snapshot, the guide position (scene + dialogue line) and the camera, and passes plain props down to `Stage`, `DialogueBox`, `UserPrompt` and `TopBar`. All scene content and every prompt lives in `app/lib/guide.ts`. Each step plays as two shots joined by hard cuts (`reset` → `setConditioning` → `start`). See `docs/DOCUMENTATION.md` for the file map.

All the code referenced below exists in this repo. Read this guide alongside the source.

## What Helios actually is, in three sentences

Helios is a **continuous, prompt-driven** video model. Once it starts generating, it produces an unending stream of video on a single track (`main_video`) — there is no "request, get clip, end". You steer the scene mid-stream by changing the prompt (which the model picks up on the next chunk), or by changing the reference image (which retints the conditioning without restarting).

The frontend's job is to (a) start the generation, (b) keep the user steering it, and (c) gracefully reflect the model's state.

## The four concepts you'll touch

| Concept        | What it is                                                                         | Hook / API                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Connection** | The lifecycle of the model session (`disconnected → connecting → waiting → ready`) | `useHelios().status`, `.connect()`, `.disconnect()`                                                                            |
| **Events**     | Things you send TO the model. Always async.                                        | `useHelios().setPrompt({...})`, `.setImage({...})`, `.setConditioning({...})`, `.start()`, `.pause()`, `.resume()`, `.reset()` |
| **Messages**   | Things the model sends BACK to you — including the all-important `state` snapshot. | `useHeliosState((m) => …)`, `useHeliosCommandError`, `useHeliosImageAccepted`, etc.                                            |
| **Tracks**     | The model's video output, rendered as a live `MediaStreamTrack`.                   | `<HeliosMainVideoView />`                                                                                                      |

You almost never have to drop below this surface. If you find yourself reaching for `@reactor-team/js-sdk` directly, stop and re-read the typed hooks list — there's likely a typed hook you're missing. The one documented exception is the recording surface (see [Capturing clips](#capturing-clips) below), which is a base-SDK feature that the typed packages deliberately do not re-export.

## The UI phases

A real-time video session is a state machine, and the screen reflects it. `Game.tsx` derives three phases from the connection status and its own `onAir` flag:

| Phase | When | What's on screen |
| --- | --- | --- |
| **Offline** | `status !== "ready"` | Title screen in place of the video. The dialogue is fully readable and Prev/Next work. "Connect to see it live" in the textbox. |
| **Ready** | `status === "ready" && !onAir` | Still the title screen. "Start the scene" appears. |
| **Live** | `status === "ready" && onAir` | The video, Pause/Resume in the top bar, the Close-up / Desk view toggle. `shot` says which shot is on screen, and `cutting` is true while a hard cut is in flight. |

**Why `onAir` and not `snapshot.started`?** A hard cut calls `reset()`, which drops `snapshot.started` to false for a moment before the next `start()`. Gating the UI on `started` would flash the title screen on every step change. `onAir` is set once the player starts the video and only cleared on disconnect or a refused cut. Use `snapshot` for model facts (`running`, `paused`, `current_chunk`), and `live` / `shot` / `cutting` for what the UI should show.

### When you add a new control, decide its phase first

- **Primes a session** (e.g. a seed picker) → show it when not `live`.
- **Adjusts the live scene** (e.g. an image-strength slider) → show it only when `live`, and disable it while `cutting`.
- **Always on** (e.g. a stats panel) → no phase gate; just disable interactivity unless `status === "ready"`.

Controls live in `Game.tsx` (a `Choice` button in the textbox) or `TopBar.tsx`. Pass state down as props rather than having each component subscribe to its own snapshot; that keeps the hard-cut logic in one place.

## What's intentionally not exposed (and where to add it)

The model offers more knobs than this app surfaces. Each one is a typed method on `useHelios()`:

| Knob                  | Hook                                                        | Phase                        | Notes                                                            |
| --------------------- | ----------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `set_seed`            | `useHelios().setSeed({ seed })`                             | Before `start`               | `-1` = random. Read once at `start`, so every hard cut rereads it. |
| `set_sr_scale`        | `useHelios().setSrScale({ sr_scale })`                      | Any                          | `"off" \| "2x" \| "4x"`. Takes effect on the next chunk.         |
| `set_image_strength`  | `useHelios().setImageStrength({ image_strength })`          | Live                         | `0..1`. Ignored when no image is set. Hard cuts rely on the default 1.0 to open exactly on the image. |
| `schedule_prompt`     | `useHelios().schedulePrompt({ prompt, chunk })`             | Live                         | Queues a prompt at a specific future chunk.                      |
| Mid-stream image swap | `setImage({ image })` while live                            | Live                         | Morphs toward the image without restarting. Use a hard cut instead when you want the picture to change at once. |

Add the control in `Game.tsx` or `TopBar.tsx` with the right phase gate, and the rest (status gating, snapshot lifecycle, `CommandError`) already works.

## Auth — a memoizing `jwtToken` resolver + a scoped mint route

Two pieces work together: a Next.js GET route that mints a session-scoped JWT
server-side, and a `jwtToken` resolver on `<HeliosProvider>` that the SDK calls on
every Reactor API hop.

### `jwtToken` takes a string **or** a resolver

```tsx
type JwtSource = string | (() => string | Promise<string>);
```

`HeliosApp.tsx` passes `jwtToken={fetchToken}`. The SDK re-invokes that function on
every Reactor API call — `POST /sessions/:id/uploads`, `GET /clips`, ICE refresh,
SDP renegotiation — so a token aging out mid-session can't 401 those hops. A bare
string works too, but it fixes one value at construction time and breaks the
moment that value expires.

(Porting from js-sdk 2.x: the prop used to be a separate `getJwt`. It is gone;
`jwtToken` absorbed both shapes, and TypeScript catches the rename.)

The provider stabilizes the resolver via `useRef + useMemo`, so an inline arrow is
safe — a parent re-render does **not** tear the session down. Do not wrap it in
`useCallback`.

Clip surfaces (`<ClipPlayer>`, `<ClipDownloadButton>`, `useClipDownload`) inherit
the resolver through React context, so you never pass it to them by hand — see
[Capturing clips](#capturing-clips).

### The resolver memoizes, and that is load-bearing

`fetchToken` holds the minted token in module scope until shortly before it
expires, and fetches with `cache: "no-store"`. **Do not hand this job to the
browser's HTTP cache.** The token is session-scoped: a session may only be
operated by the exact token that created it, so every hop of one session must
present the same JWT. A browser cache cannot promise that — DevTools "Disable
cache" and ordinary eviction both make it miss — and on a miss the resolver mints
a fresh token with no bound sessions, so the next upload or clip call answers:

```
403 … this token is session-scoped and is not authorized for this resource;
mint it again with authorization_details.resources.sessions.bind …
```

Owning the memo in the app makes the token's lifetime something the app controls:

```tsx
const TOKEN_REFRESH_SKEW_MS = 60_000;
let cachedToken: { jwt: string; expiresAtMs: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS) {
    return cachedToken.jwt;
  }
  if (inflightToken) return inflightToken; // coalesce connect-time parallel hops
  // … fetch("/api/reactor/token", { cache: "no-store" }), store { jwt, expires_at } …
}
```

The edge it does not cover: a session created just before the memo expires is
orphaned at the re-mint, because the fresh token is not bound to it. Covering that
needs a re-mint naming the live session in
`authorization_details.resources.sessions.bind`.

### The route — `app/api/reactor/token/route.ts`

Already implemented. You usually don't need to touch it, but here's why it works
the way it does so you don't accidentally break it:

1. **It returns `expires_at` alongside the JWT.** Reactor's `/tokens` endpoint
   takes an `expires_after` body and answers `{ jwt, expires_at }`. Handing
   `expires_at` to the client is what lets the resolver memoize for exactly the
   lifetime the server granted rather than a number guessed in the client.
2. **`Cache-Control: private, no-store`.** The client owns the cache (above), and
   `private` keeps any CDN or proxy from storing a per-user credential.
3. **GET, not POST.** Nothing about the request varies, so a GET reads as the
   lookup it is. The handler still POSTs to Reactor internally.
4. **`authorization_details` scopes the token.** The mint pins the JWT to this
   app's model with a bounded session budget (`max_sessions`): the browser's token
   can only create sessions for that one model and act on the sessions it created
   — everything else on the account answers 403. Never hand a browser an unscoped
   token; that is the API key's full user-level access in cookie-jar form.

Your `rk_` API key never leaves the server. The JWT is the only credential the
browser ever holds.

### Configuring autoConnect

`<HeliosProvider>` is initialized **without** `autoConnect`. The user clicks "Connect" so they see the `disconnected → connecting → waiting → ready` transitions. If you're shipping a polished product where you'd rather the connection happen on page load:

```tsx
<HeliosProvider jwtToken={fetchToken} connectOptions={{ autoConnect: true }}>
```

Just make sure your status indicator still surfaces the intermediate states (`connecting`, `waiting for GPU`) — sessions don't reach `ready` instantly, and you don't want users staring at an unexplained loading state.

## The state snapshot — your UI's single source of truth

Helios emits a `state` message after every command and every completed chunk. Subscribe via `useHeliosState`, hold it in `useState`, and read fields off it. **Don't aggregate `chunk_complete`, `generation_started`, `generation_paused` and try to reconstruct state yourself** — the snapshot already contains everything.

```tsx
const [snapshot, setSnapshot] = useState<HeliosStateMessage | null>(null);
useHeliosState((msg) => setSnapshot(msg));
```

Fields you'll actually read:

| Field                             | Meaning                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `started`                         | True once `start()` has succeeded. Stays true through pause. Reset to false by `reset()`. **This is the phase switch.**                                 |
| `running`                         | True while the model is actively producing frames. Equal to `started && !paused`.                                                                       |
| `paused`                          | True after `pause()`, false again after `resume()`.                                                                                                     |
| `current_prompt`                  | The prompt currently driving generation. `null` (typed as `unknown`) before `start()`. Useful for showing what's playing. |
| `current_chunk` / `current_frame` | Progress counters since the last `reset` / connect.                                                                                                     |
| `image_set`                       | True if a reference image has been provided this session.                                                                                               |

### Clear the snapshot on disconnect

The SDK does not emit a final `state` message when the session ends. Without an explicit reset, the last snapshot from the previous session lingers in your component's state — so after a reconnect, your UI shows stale "we're still generating!" data until the new session's first `state` arrives.

`Game.tsx` does this (and also resets `onAir` and the shot):

```tsx
useEffect(() => {
  if (status !== "ready") setSnapshot(null);
}, [status]);
```

When you add a new component that subscribes to `useHeliosState`, include this. Three lines, no abstraction needed.

## Sending commands — the typed methods

Every command Helios accepts has a typed wrapper on `useHelios()`. Await them: a
command resolves when the model's handler has finished, and carries whatever that
handler answered with.

**None of them reject.** A refusal arrives as a broadcast `command_error` and
resolves the call with `undefined`; so does a send that never completed, with the
reason on `lastError`. So `try/catch` is not how you detect a failed command —
checking the resolved value is.

```tsx
const { setPrompt, setImage, setConditioning, start, pause, resume, reset } =
  useHelios();

// Text-to-video
await setPrompt({ prompt: "A serene mountain lake at sunrise…" });
await start();

// Image-to-video (both pieces known up front)
await setConditioning({ prompt: "A serene mountain lake…", image: ref });
await start();

// Transport
await pause();
await resume();
await reset();
```

**`setConditioning`** commits a prompt and an image as one transaction. Prefer it over separate `setImage` + `setPrompt` calls whenever both pieces of conditioning are known at the same time — see the next section for why.

**Never reach for `sendCommand("set_prompt", ...)` when a typed method exists.** You lose autocomplete and the param-name typo check.

### Status-gate every interactive control

Sending an event when `status !== "ready"` is a no-op with a console warning. Surface this as `disabled` on the button so the user sees what's clickable:

```tsx
const { status, setPrompt, start } = useHelios();
const ready = status === "ready";

<button disabled={!ready || !text.trim()} onClick={...}>Start generating</button>
```

On disconnect, the gate trips and your new control greys out automatically — exactly the same visual state as a freshly loaded, never-connected page.

## Where a result arrives: the call, or a subscription

This is the one thing to get right, and nothing about getting it wrong is a
compile error.

The model answers a command in one of two ways, and which one decides where your
code reads the answer:

| The model | Reaches you | Helios commands |
| --- | --- | --- |
| **answers** the command that asked | the awaited call's return value — and the **sending** connection's `message` event | `setPrompt`, `setImage`, `setConditioning`, `pause`, `resume`, `rewind`, `saveSnapshot`, `listSnapshots`, `schedulePrompt` |
| **broadcasts** to every connection on the session | the subscription — `useHeliosState`, `useHeliosCommandError`, `useHeliosChunkComplete`, … | the `state` snapshot, `command_error`, per-chunk progress, `generation_started`, `rewind_failed` |
| answers with **nothing** | the await resolves `undefined`; nothing reaches the message event | `start`, `reset`, `setSeed`, `setSrScale`, `setImageStrength` |

An answer is **addressed**: the runtime sends it to the one connection whose
command earned it, correlated by request id. On that connection it arrives twice
over — it resolves the awaited call, and the same frame also raises the `message`
event, so a typed hook for an answer does fire. No other connection in the session
sees it at all.

So read the answer off the await, not off a hook — not because the hook is dead,
but because the await is tied to **your** call:

```tsx
// ⚠️ fires, but not usefully: this handler sees the answer to any setImage
// on this connection, with no way to tell which call it belongs to — and on a
// second client it never fires at all.
useHeliosImageAccepted((msg) => setDimensions(msg));

// ✅ tied to this call, and it tells you the handler finished
const accepted = await setImage({ image: ref });
if (accepted) setDimensions(accepted);
```

The corollary matters for multi-client sessions: anything every client has to
agree on must **broadcast**. That is what the `state` snapshot is for — never
build shared UI state out of answers.

Awaiting a command that answers with nothing is still worth doing. The runtime
acknowledges every correlated command once its handler has run, so a resolved
`await start()` means the model started — not merely that bytes left the browser.
There is never a reason to `setTimeout` after a command to "give the model time".

### Chaining conditioning before `start()`

Because awaiting `setImage` now waits for the model to decode the image, the old
race is gone — a plain chain is correct:

```tsx
await setImage({ image: ref });   // resolves once the model has decoded it
await setPrompt({ prompt: "…" });
await start();
```

**`setConditioning` is still the better call when you know both pieces up front**,
for a different reason than before. It is one message and one handler, so the
model validates, decodes, and commits both as a single transaction: if
anything fails (no prompt, no image, non-image MIME, undecodable bytes) it emits
`command_error` and **mutates nothing**, leaving no partial state to recover from.
Two separate awaited commands can each succeed or fail on their own, which means a
half-conditioned session is reachable.

```tsx
async function startFromImage(url: string, prompt: string) {
  const blob = await fetch(url).then((r) => r.blob());
  const ref = await uploadFile(blob, { name: url.split("/").pop()! });

  const ready = await setConditioning({ prompt, image: ref });
  if (!ready) return; // refused; CommandError already says why
  await start();
}
```

Use `setConditioning` when priming a fresh generation with both pieces — every
hard cut in `Game.tsx` does. Fall back to one piece at a time only when there is
a genuine gap between them: `direct()` in `Game.tsx` sends only a prompt,
because the model is already running and the image should stay.

### Telling a refusal from a bodyless answer

`undefined` has two meanings: the send failed, or the handler completed and
returned nothing. For a command that declares an answer, `undefined` means
something went wrong — but to say *which*, compare `lastError` across the call
rather than reading it bare, because it is a persistent record that success never
clears:

```tsx
const before = lastError;
const accepted = await setImage({ image: ref });
if (!accepted) {
  // lastError !== before → the send failed; otherwise the model refused
  // and command_error carries the reason.
}
```

For one-at-a-time UI commands that snapshot is reliable. A concurrent unrelated
error during the await can still false-positive.

## Receiving messages — the typed hooks

`@reactor-models/helios` ships one typed subscription hook per message:

Whether a hook fires on **every** connection or only on the one that sent the
command depends on how the model produced the message — see the table above.
Helios splits three ways, and the split is worth knowing before you rely on a
hook to keep a second client in step:

| Hook                                                              | Reaches                             | Purpose                                                                                                                                                            |
| ----------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useHeliosState(handler)`                                         | every connection                    | The state snapshot. **Use this; almost everything you need is here.**                                                                                              |
| `useHeliosCommandError(handler)`                                  | every connection                    | A command was rejected (bad preconditions, bad input). Render this somewhere visible.                                                                              |
| `useHeliosChunkComplete(handler)`                                 | every connection                    | One chunk finished generating. Useful for progress sounds, telemetry.                                                                                              |
| `useHeliosGenerationStarted(handler)`                             | every connection                    | Generation began. Useful for a one-shot reaction, but **don't aggregate it into your own state** — read the snapshot instead.                                       |
| `useHeliosRewindFailed(handler)`                                  | every connection                    | How `rewind` and `saveSnapshot` report failure — they broadcast this rather than answering with it.                                                                 |
| `useHeliosConditionsReady(handler)`                               | every connection, **and** the sender | Broadcast by `setPrompt` and `setImage` after each commits; **also** the answer to `setConditioning`. Both paths are live.                                          |
| `useHeliosPromptAccepted(handler)`                                | every connection, **and** the sender | Broadcast by `setConditioning` (which commits a prompt on the way to its own answer); **also** the answer to `setPrompt` / `schedulePrompt`.                        |
| `useHeliosImageAccepted(handler)`                                 | every connection, **and** the sender | Broadcast by `setConditioning`; **also** the answer to `setImage`.                                                                                                 |
| `useHeliosGenerationPaused` / `Resumed`                           | the sender only                     | Answers to `pause` / `resume`. A second client never sees them — gate shared UI on `snapshot.paused` instead.                                                       |
| `useHeliosRewindComplete`, `useHeliosSnapshotSaved`, `useHeliosSnapshotList` | the sender only          | Answers to `rewind`, `saveSnapshot`, `listSnapshots`. Read them off the awaited call; the hook only ever fires for a command this connection sent.                  |
| `useHeliosMessage(handler)`                                       | both                                | Catch-all over the typed discriminated union. Useful for devtools / logging.                                                                                       |

### Always surface `command_error`

`app/components/CommandError.tsx` already does this. The pattern:

```tsx
"use client";
import { useState } from "react";
import { useHeliosCommandError, useHeliosState } from "@reactor-models/helios";

export function CommandError() {
  const [err, setErr] = useState<{ command: string; reason: string } | null>(
    null,
  );
  useHeliosCommandError((m) =>
    setErr({ command: m.command, reason: m.reason }),
  );
  useHeliosState(() => setErr(null)); // any state update means the user moved on
  if (!err) return null;
  return (
    <div className="error">
      {err.command} failed: {err.reason}
    </div>
  );
}
```

When you add a new event method, this will surface its failures automatically — no changes needed.

## Hard cuts — the image-to-video flow this app uses

Every shot change in this app is a hard cut: a fresh generation whose first frame is locked to an image. `cut()` in `app/components/Game.tsx` does it:

```tsx
const image = await uploadFile(blob, { name });   // upload before the reset
await reset();                                    // stop the old generation
if (!(await setConditioning({ prompt, image }))) return; // refused → CommandError says why
await start();
```

1. Get the bytes: `fetch(url).then(r => r.blob())` for the guide's sprite or a step image, or a frame grabbed from the live `<video>` onto a canvas (the seated desk keyframe).
2. `await uploadFile(blob)` → a `FileRef`. Do it **before** `reset()`, so the screen holds its last frame for as short a time as possible.
3. `await reset()`, then `await setConditioning({ prompt, image: ref })` — atomic. The SDK lifts the `FileRef` into an `uploads` envelope automatically. `image_strength` defaults to 1.0, so the first frame is the image.
4. `await start()`.

**Every await is a chance to be overtaken.** The player can press Next again mid-cut. `cut()` takes a sequence number (`cutSeq`) and returns at the next await if a newer cut has started. Copy that guard for anything else that runs a multi-step command chain.

**Why not `setImage` mid-stream?** It is a conditioning tweak: the video morphs toward the new image over a few chunks. That is right for a gradual change and wrong for a cut.

### Adding a user image upload

To let the player upload their own image, take `e.target.files[0]` from an `<input type="file">` and run it through the same `uploadFile` → `reset` → `setConditioning` → `start` chain, with a prompt from `promptForDirection`. Don't overwrite a prompt the player typed.

## Scene content — `app/lib/guide.ts`

All content lives in one file:

- `GUIDES` — the selectable characters: sprite path, name colour, select-screen blurb, a `description` that matches the sprite, and a `prop` for the worktable.
- `SCENES` — the prologue, 18 steps and the ending. Each has dialogue `lines`, the desk-shot `action`, an optional `part` photo, and an optional `build` close-up (`/steps/NN.jpg` plus the `shot` text).
- `promptForScene`, `promptForCloseUp`, `promptForDirection` — build the prompt for each kind of shot.

**Adding a scene = one entry in `SCENES`.** **Adding a guide = a sprite in `public/characters/` plus one entry in `GUIDES`.** No component changes.

### Prompts must be full paragraphs with explicit visual continuity

This is the most underrated part of building a real-time video frontend, and the #1 reason scenes look choppy when they should be smooth.

**Each prompt is a paragraph**, not a tagline. Describe the subject, the action, the environment, the lighting, AND the camera shot. Single-sentence prompts produce visually unstable output because the model has to invent everything else from scratch each chunk.

**Only the action changes between prompts.** Every desk prompt is `STYLE + CHARACTER + action + SETTING + CAMERA`, and everything but the action is a constant repeated verbatim. That stability is what lets Helios swap prompts mid-stream without the scene visually resetting. When you write a new scene, write only the `action`: start with a verb, avoid he/she so it fits any guide, and never have the guide stand up (later desk shots start from a seated frame).

## Mid-stream prompt switching

This is Helios's signature capability. Once `started === true`, calling `setPrompt({ prompt })` is a **hot-swap on the next chunk** — no restart, no `start()` again. The scene continues from exactly where it was, with the new prompt influencing subsequent frames.

`direct()` in `app/components/Game.tsx` is the pattern: when the player types a direction during a live shot, it wraps the text in the same style and character and swaps the prompt in place:

```tsx
async function direct(text: string) {
  if (!ready) return;
  setDirection(text);
  const prompt = promptForDirection(text, scene, guide);
  if (live) await setPrompt({ prompt }); // hot-swap, no cut
  else await cut("desk", scene, prompt);  // not running yet: start a shot
}
```

Notice: **no `start()`** on the live path. The model is already generating; we're just swapping the prompt, and it picks up the new one on the next chunk.

If you build a new control that mutates the live scene (e.g. a slider for image strength), follow the same pattern — call the typed method, don't touch `start()`.

## Capturing clips

The Reactor base SDK exposes a recording surface that works for every model: ask for the last N seconds of the live stream, get back a `Clip`, and either preview it with `<ClipPlayer>` or download it with `<ClipDownloadButton>`. The model SDK does not own this — it lives on `@reactor-team/js-sdk` because it is the same call for Helios, Lingbot, and every future model with recording enabled.

This app does not include clip capture (the stock Reactor template's `SnapClip` panel was removed), but `hls.js` is still a dependency, so adding it back is a single component: a "Capture" button that calls `requestClip(durationSeconds)` off the store, opens a modal with the SDK's preview player, and offers an MP4 download. It is **model-agnostic** — nothing in it is specific to Helios.

### When to reach for `@reactor-team/js-sdk` directly

The default rule still applies: do everything via `@reactor-models/helios`. But the typed package only re-exports model-specific surface (events, messages, the typed provider/hook). The recording surface is base-SDK only, so for that one feature you import directly:

```tsx
import {
  ClipDownloadButton,
  ClipPlayer,
  RecordingError,
  useReactor,
  type Clip,
} from "@reactor-team/js-sdk";
```

When you scaffold a new component, ask: "Does this depend on Helios-specific events, messages, or commands?" If yes → typed package only. If no, and it would work the same on any model (recording, generic stats, generic connection state) → `@reactor-team/js-sdk` is fine.

### The pattern

The shape that matters:

1. **Destructure the recording action off the store.** `useReactor((s) => s.requestClip)` is the canonical accessor in 3.x — `requestClip`, `requestRecording`, and `downloadClipAsFile` are first-class actions alongside `connect` / `disconnect` / `uploadFile`. No `s.internal.reactor` indirection.
2. **Gate on connection status.** `useReactor((s) => s.status)` — return `null` when status is not `"ready"`, so the panel disappears on disconnect just like every other live-only control.
3. **Catch `RecordingError`.** Recording can fail with typed reasons (`DISCONNECTED`, `RECORDER_DISABLED`, `INVALID_DURATION`, `REQUEST_TIMEOUT`). Surface them inline like `CommandError` does.
4. **Compose `<ClipPlayer>` + `<ClipDownloadButton>` in a modal, route their errors through callbacks.** Both accept `onError` (and `<ClipDownloadButton>` also accepts `onSuccess(blob)`); thread them into the same inline error line that `requestClip` failures use. The SDK's components stay usable after disconnect, so the modal keeps working if the session ends mid-preview.
5. **No auth plumbing.** Both clip components inherit the resolver from `<HeliosProvider jwtToken={…}>` via React context. That is the single source of truth for auth in this app — the capture component doesn't need to know about the JWT route at all.

### The portal gotcha (Sonner toasts, headless modals)

The context-inheritance only works for components rendered **inside** the provider subtree. A modal rendered as a normal child of the capture button inherits the resolver fine.

The trap is rendering clip UI through a React portal whose host lives _outside_ `<HeliosProvider>` — most commonly a Sonner `<Toaster />` mounted in `app/layout.tsx` as a sibling of `{children}`. The custom-toast tree has no `ReactorContext` in scope, the fallback returns `undefined`, and the Reactor API answers the clip download with:

```
{"error":"Missing Authorization header"}
```

Fix: capture the resolver imperatively _inside_ the provider subtree, then thread it down as an explicit prop. The resolver outlives `disconnect()` by design, so the toast keeps minting fresh tokens even after the session ends.

```tsx
function HandlerInsideProvider() {
  // `requestClip` is a top-level store action; `internal.reactor`
  // stays in the escape-hatch slot for `getJwtResolver()` because
  // that one isn't lifted onto the store surface.
  const { requestClip, reactor } = useReactor((s) => ({
    requestClip: s.requestClip,
    reactor: s.internal.reactor,
  }));

  const onSnap = async () => {
    const clip = await requestClip(30);

    // Captured here — works because we're inside the provider.
    // The closure carries it across Sonner's portal boundary.
    const getJwt = reactor.getJwtResolver();

    toast.custom(() => <ClipReadyToast clip={clip} getJwt={getJwt} />);
  };
}
```

### hls.js is an optional peer

`<ClipPlayer>` plays HLS natively on Safari/iOS. On Chrome / Firefox / Edge it dynamically imports `hls.js` — which is why the app declares it as a direct dep (`hls.js@^1.6.0`). If `hls.js` isn't installed, the player surfaces an inline error and downloads still work; the dep keeps the preview path functional for the majority of users.

### Extending

Give the component a `durationSeconds` prop (10 is a good default). For multi-clip galleries, store an array of `Clip` instead of a single one, render a thumbnail per entry, and pass each to `<ClipPlayer>` / `<ClipDownloadButton>` on click. The headless [`useClipDownload`](https://docs.reactor.inc/api-reference/react-hooks#useclipdownload) hook is what to use if you want a custom progress UI instead of the default button.

### Full-session recordings

`requestRecording()` (no args, also on the store) grabs everything from the start of recording up to now, instead of a trailing window. Same `Clip` shape, longer manifest, larger MP4. Use it for a "Save the whole session" button.

### Clips are short-lived

The URL on a `Clip` expires after a few minutes. Do not store `Clip` objects long-term, and do not hand `clip.playlistUrl` to your users for sharing. If you want a permanent link, download the MP4 (via `<ClipDownloadButton>` or `downloadClipAsFile(clip, null)` for a Blob) and host the result yourself.

### Clip downloads are social-media-ready

Behind the existing `<ClipDownloadButton>` / `reactor.downloadClipAsFile()` API the SDK now remuxes the fragmented MP4 the runtime ships into a flat MP4 with `start_time=0` and faststart layout, using `mp4box` as a bundled runtime dep. The transformation is `ffmpeg -c copy` style — no decode, no re-encode, the H.264 / AAC bitstream is bit-identical. The Blob you get back uploads cleanly to Twitter, Instagram, TikTok, YouTube; opens with `start_time=0` in QuickLook; and on the rare parse failure falls back silently to the previous fragmented bytes (logged via `console.warn`), so the download never fails outright. No knob, no API change.

## Styling — theme tokens, not hex

The dating-sim palette is defined once as Tailwind v4 theme tokens in `app/globals.css`:

```css
@theme {
  --font-sans: var(--font-rounded), ui-rounded, system-ui, sans-serif;
  --color-ink: #4a3352;        /* text */
  --color-blush: #f47fa6;      /* the guide's accent */
  --color-blush-deep: #d6537f; /* bold dialogue, button shadow */
  /* … blush-soft, blush-mist, backdrop, panel, frame, shadow */
}
```

Use them as plain utilities — `text-ink`, `bg-blush`, `border-frame` — in any component, server or client. The font (M PLUS Rounded 1c) is loaded with `next/font` in `app/layout.tsx`. A guide's name-plate colour is the one per-guide value, and it comes from `Guide.color`.

`@reactor-team/ui` is installed but not used. If you import its React components, keep them in Client Components: they use hooks internally.

## Common mistakes when extending

1. **Reaching for `@reactor-team/js-sdk` directly.** Everything Helios-specific is on `@reactor-models/helios`. If you find yourself reaching for `useReactor((s) => s.internal.reactor)` for a Helios event or message, re-read the typed hooks list above. The one allowed exception is the recording surface — see [Capturing clips](#capturing-clips). Recording itself is a top-level store action (`s.requestClip` / `s.requestRecording` / `s.downloadClipAsFile`); reach for `s.internal.reactor` only for the few surfaces that are not lifted onto the store (`getJwtResolver()`, raw `runtimeMessage` subscriptions).
2. **Aggregating events to reconstruct state.** Subscribe to `useHeliosState` and read fields off the snapshot. Stop folding `chunk_complete` + `generation_started` + `generation_paused` into your own boolean flags.
3. **Chaining `setImage + setPrompt + start` instead of using `setConditioning`.** Separate commands can be reordered on the wire — `start` slips past the still-resolving image upload and the first chunk renders with no image conditioning. When both pieces are known up front, use `setConditioning({ prompt, image })` for a single atomic message. Only fall back to `setImage` alone when the prompt arrives later from a different user action.
4. **Gating the UI on `snapshot.started`.** Every hard cut resets it to false for a moment. Gate on `live` / `cutting` from `Game.tsx` instead.
5. **Forgetting to clear the snapshot on disconnect.** The next session's UI will show stale state. Three lines of `useEffect` in any component that holds a snapshot.
6. **`if (snapshot?.started) return null` without a status check.** After disconnect, `snapshot.started` may still be true (stale until the effect clears it). Always gate on `status === "ready"` too.
7. **Connecting from a `useEffect` in your own component.** The Provider owns connection lifecycle. Don't fight it; configure it via the `connectOptions` prop instead.
8. **A multi-step command chain without a staleness guard.** The player can press Next mid-cut. Without the `cutSeq` check, an old cut finishes after the new one and the wrong shot wins.
9. **Single-line prompts, or prompts that change more than the action.** The model needs paragraph-length prompts with explicit visual continuity. Short prompts produce choppy output; changing the style, character or setting between prompts makes the scene visibly reset.
10. **A new custom hook for one component.** Inline the pattern first. Extract when you have three call sites of the same logic.
11. **Writing a desk `action` where the guide stands up.** Later desk shots start from a seated frame, so a standing action fights the image.

## Checklist for new components

Before merging a new control or feature:

- [ ] Decided which phase it lives in (Offline/Ready, Live, or always-on) and gated it on `live` / `cutting`, not `snapshot.started`
- [ ] If it subscribes to `useHeliosState` itself, it clears on disconnect via `useEffect`
- [ ] All interactive controls gate `disabled` on `status === "ready"`
- [ ] All event method calls use the typed wrappers (`setPrompt`, not `sendCommand("set_prompt", …)`) and are `await`ed
- [ ] If priming a session with prompt + image, uses `setConditioning({ prompt, image })` so a failure cannot leave the session half-conditioned
- [ ] Reads a command's acceptance off the awaited call, not off a `use*Accepted` subscription (those can't tell which call they belong to)
- [ ] Treats a falsy resolved value as the failure signal, rather than expecting a rejection
- [ ] Renders `command_error` somewhere visible (the existing `CommandError` component handles this automatically — don't suppress it)
- [ ] New scenes in `app/lib/guide.ts` only add an `action` (and `lines`); the style, character, setting and camera stay shared
- [ ] Colors via the theme utilities (`text-ink`, `bg-blush`), not hardcoded hex
- [ ] No imports from `@reactor-team/js-sdk` or `@reactor-team/ui` React components unless absolutely required (recording surface is the documented exception — see [Capturing clips](#capturing-clips))
