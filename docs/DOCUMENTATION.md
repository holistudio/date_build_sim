# PC Build Route ♡

A PC build tutorial (an i5-14600K + RTX 5060 Ti "Great Intel Gaming Build")
as an anime dating-sim visual novel. Aoi or Haruto walks you through all 18
steps in a textbox, and a live [Helios](https://www.reactor.inc) video stream
shows each step in a cel-shaded visual-novel style. Scaffolded with
`npx create-reactor-app pc-build-sim --model=helios`.

## Run it

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Set `REACTOR_API_KEY=rk_...` in `.env` before `pnpm dev`, then open
http://localhost:3000. If `pnpm` isn't found, run `corepack enable` once.

API keys come from [reactor.inc/account/api-keys](https://www.reactor.inc/account/api-keys).
Without a key the app shows a setup screen instead.

## Images (not included)

The `public/` folder is not in the repo: the part photos are product shots
we can't redistribute, and the character and step art was generated for this
project. Before you run the app, add your own images at these exact paths.
You can find photos online or generate them with an image model such as
Nano Banana (Gemini).

| Path | Needed? | What it is |
| --- | --- | --- |
| `public/characters/aoi.jpg`, `public/characters/haruto.jpg` | **Required** for the video | Full-body standing sprite of each guide, portrait (896×1200 works). Every desk shot starts from this image, so without it the video never starts. Prompt: the guide's `description` in `GUIDES` plus the `STYLE` text, both in `app/lib/guide.ts`, on a plain background. |
| `public/steps/01.jpg` … `18.jpg` | Optional | The first frame of each step's close-up, landscape 16:9 (1376×768 works). Prompt: that step's `build.shot` in `SCENES` plus `CLOSE_UP_STYLE`. A missing image just means that step stays on the desk shot. |
| `public/parts/*.jpg` | Optional | The photo on the part card (top right of the video), square (600×600 works). Search for the product name in the scene's `part` label. The filenames are the first argument of each `part(...)` call in `SCENES`. A missing photo shows a broken card. |

Without any images the guide is still fully readable offline, but the
select screen has no portraits and the video can't start.

## How to play

The first screen asks you to choose your guide, Aoi or Haruto. That choice
is fixed for the visit: the video is seeded with their sprite and every
prompt describes them. Reload the page to choose again.

| Region (wireframe) | What it does |
| --- | --- |
| `main_game` | The live video. Each step opens on the guide at their desk, then hard-cuts to a close-up of the build (see below). Before you connect it's a title screen. The badge (top left) shows the step, and the card (top right) shows the real photo of that step's part. Click the card to enlarge it. |
| `main_game_actions` | The textbox. Click it (or press Space/Enter) to go to the next line. **Previous Step** and **Next Step** (or ←/→) change steps. **Start the scene** appears once you're connected. |
| `user_prompt` | Type your own direction ("close-up on the RAM clips") and press Enter. It becomes the live prompt, kept in the same art style and with the same character. **Back to the step** or Prev/Next returns to the guide. |

The guide works offline. You can read every step without connecting.
Connecting starts a GPU session, so press **Pause** or **Disconnect** in the top
bar when you're done.

## Where things live

| File | Contents |
| --- | --- |
| `app/lib/guide.ts` | **All content**: the guides (`GUIDES`), the art-style prompt anchors, and the 20 scenes (dialogue lines, video action, part photo). Edit this to change the text or the look. |
| `app/components/Game.tsx` | Layout, step/line state, keyboard, and the `setPrompt` / `start` calls |
| `app/components/Stage.tsx` | Video, title screen, chapter badge, progress dots, part card |
| `app/components/DialogueBox.tsx` | Name plate, typewriter text, choice buttons |
| `app/components/CharacterSelect.tsx` | The first screen: pick Aoi or Haruto |
| `app/components/UserPrompt.tsx` | The free-text direction box |
| `app/components/TopBar.tsx` | Connection status, Connect/Disconnect, Pause/Resume |
| `app/api/reactor/token/route.ts` | Mints the session-scoped JWT (unchanged from the template) |
| `public/` | Images, not in the repo: see [Images](#images-not-included) |

## Shots and hard cuts

Every step plays as two shots:

1. **Desk shot:** the guide seated at the worktable, doing the step's
   `action`. Only the first desk shot starts from the (standing) sprite;
   as it cuts away, the app keeps that video frame of the guide seated and
   starts every later desk shot from it, so they sit down once and stay
   seated. Scene actions must never have the guide stand up.
2. **Close-up:** after `DESK_CHUNKS` chunks (3, set in `Game.tsx`), a hard
   cut to the step's illustration `public/steps/NN.jpg`: hands only, with
   the camera angle and action from the prompt that generated the image
   (the scene's `build.shot`).

A hard cut is `reset` → `setConditioning({ prompt, image })` → `start`. The
fresh generation's first frame is locked to the image (`image_strength`
defaults to 1.0), so it opens exactly on your illustration. A mid-stream
`setImage` would only morph toward it. Changing step also hard-cuts, back to
the desk. **🎬 Close-up / Desk view** in the textbox cuts by hand, and typing
your own direction holds the current shot until **Back to the step**.

**Adding step images:** save them as `public/steps/NN.jpg` (the step
number, two digits; see [Images](#images-not-included)). Steps 1 to 18 already have their shot text in
`guide.ts`, and a step without an image just stays on the desk shot.

## Prompt design

Every step prompt is `STYLE + CHARACTER + action + SETTING + CAMERA`, and only
the action changes between steps. Helios swaps prompts mid-stream, and keeping
the rest identical stops the video from visually resetting when you press Next.
Each session also starts from the chosen guide's sprite in
`public/characters/`, sent with the first prompt through `setConditioning`.
Later prompt swaps keep that image, so the video stays on one character.

Each guide in `GUIDES` has a description that matches their sprite (taken
from the prompt that generated it), plus a name colour and a prop on the
workbench. Scene actions avoid he/she so they fit any guide. To add a guide,
copy their sprite into `public/characters/` and add an entry to `GUIDES`.

The dialogue restates a written build tutorial without changing any
instruction: slot names, BIOS settings, temperatures and warnings are exact.
Your motherboard and case manuals are still the final word.

`skill/SKILL.md` is a guide to the Helios SDK patterns this app uses (auth,
state snapshot, awaited commands, hard cuts). Point a coding agent at it
before extending the app.
