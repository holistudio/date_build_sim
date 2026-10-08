// The build route: every scene of the PC-build visual novel.
//
// The dialogue restates a written PC-build tutorial in the guide's voice,
// but never changes an instruction: slot names, headers, temperatures,
// keys and warnings are copied as written. If you correct an instruction,
// keep that precision.
//
// Each scene has:
//   - `lines`: the dialogue pages shown in the textbox (click to advance).
//     `**bold**` renders as emphasis.
//   - `action`: what the guide does in the desk shot, the scene's opening
//     shot. `promptForScene` wraps it in the same style, character,
//     setting and camera text every time.
//   - `build` (steps only): the close-up the video hard-cuts to after the
//     desk shot. Its image is the step illustration public/steps/NN.jpg,
//     and `shot` is the image-generation prompt that produced it. A step
//     whose image doesn't exist yet simply stays on the desk shot.

export interface PartImage {
  src: string;
  label: string;
}

export interface CloseUp {
  /** Step illustration, served from public/steps/. */
  image: string;
  /** What the close-up shows: the camera angle and the hands' action. */
  shot: string;
}

export interface Scene {
  id: string;
  /** Short label for the chapter badge, e.g. "Step 3". */
  chapter: string;
  title: string;
  lines: ReadonlyArray<string>;
  /** What the guide is doing in this scene. Starts with a verb, avoids
   * he/she/his/her so it fits any guide, and never stands up: the guide
   * stays seated at the worktable in every desk shot. */
  action: string;
  part?: PartImage;
  build?: CloseUp;
}

// ── Guides ───────────────────────────────────────────────────────────
//
// The characters who can lead the build. The player picks one on the
// select screen. Their base sprite (public/characters/) seeds the video
// (sent with the first prompt of a session), and `description` says the
// same thing in words so the image and the prompt never disagree.
//
// Each description follows the image-generation prompt that produced the
// sprite and the character's design notes, checked against the image.

export interface Guide {
  id: string;
  name: string;
  /** Seed image, served from public/. */
  image: string;
  /** Name-plate colour. */
  color: string;
  /** Select-screen epithet and blurb. */
  title: string;
  blurb: string;
  /** Who they are and what they wear. Ends with a comma: the scene's
   * action follows it. */
  description: string;
  /** Their own thing on the worktable, placed in the setting. */
  prop: string;
}

export const GUIDES: ReadonlyArray<Guide> = [
  {
    id: "aoi",
    name: "Aoi",
    image: "/characters/aoi.jpg",
    color: "#4fa3e0", // sky blue
    title: "The fantasy enthusiast",
    blurb:
      "Cheerful and quick to befriend anyone, with excellent hands-on intuition. “Wait, so a battery is like a mana pool?”",
    description:
      "Aoi Hinata, a cheerful, energetic Japanese high-school girl with short, bright, slightly messy honey-blonde hair, two star-shaped hair clips on one side, big expressive bright blue eyes and a friendly open smile, wearing her summer school uniform of a white collared shirt with the sleeves rolled up, a sky-blue ribbon bow at the collar and a navy pleated skirt,",
    // Her school bag is covered in fandom pins.
    prop: "her school bag covered in colorful fantasy pins resting at one end of the bench",
  },
  {
    id: "haruto",
    name: "Haruto",
    image: "/characters/haruto.jpg",
    color: "#c9962e", // warm gold
    title: "The golden vice-president",
    blurb:
      "A charming, easygoing senpai who secretly loves building and fixing things.",
    description:
      "Haruto Mizushima, a tall, charming Japanese high-school boy with a lean, tidy build, neat, softly layered medium-length dark brown hair, warm amber-brown eyes and an easy, friendly smile, wearing his summer school uniform of a crisp white short-sleeved collared shirt, a dark-blue necktie, navy trousers and a thin gold wristwatch,",
    // He secretly loves fixing things, starting with his late
    // grandfather's vacuum-tube radio.
    prop: "an old wooden vacuum-tube radio resting at one end of the bench",
  },
];

// ── Prompt anchors, repeated verbatim in every prompt ─────────────────
//
// STYLE follows the shared style block of the prompts that produced the
// sprites.

const STYLE =
  "Anime dating sim visual novel scene in the style of a modern Japanese visual novel, clean crisp lineart with soft cel shading and subtle gradients, a pastel, slightly desaturated palette with blue-lavender shadows, warm afternoon light with a gentle rim light.";

// The room both shots share, from the setting of the step-illustration
// prompts, so the cut from the desk shot to the close-up stays in one
// place.
const ROOM =
  "a wooden worktable beside tall bright windows with white sky and soft clouds outside, a few pink cherry-blossom petals scattered nearby";

const setting = (guide: Guide) =>
  `The scene is a bright, sunlit room with ${ROOM}, PC parts laid out on the table and ${guide.prop}.`;

const CAMERA =
  "Medium shot at eye level, framed like a visual novel character sprite over a detailed background, with the worktable across the bottom of the frame.";

// The guide sits down once, in the first desk shot, and stays seated:
// every desk prompt says so, and from the second desk shot on the video
// starts from a seated frame (see the desk keyframe in Game.tsx).
export function promptForScene(scene: Scene, guide: Guide): string {
  const action = scene.action.replace(/,\s*$/, ".");
  return `${STYLE} ${guide.description} is seated at the worktable and stays seated the whole time, never standing up. ${guide.name} ${action} ${setting(guide)} ${CAMERA}`;
}

// The close-up: the step illustrations' style and hands-only rules,
// rewritten for video (no reference image, no output size), opening with
// "Hard cut to" the way Reactor's fast-h3 template opens every new shot.
// The step image is the first frame; this prompt drives the motion from
// there.
const CLOSE_UP_STYLE = `Anime background-art illustration: clean polished digital painting, soft cel shading, crisp linework on objects, gentle bloom and lens glow, bright sunlit atmosphere with cool blue-lavender shadows and warm golden light. Setting: ${ROOM}.`;

export function promptForCloseUp(closeUp: CloseUp, guide: Guide): string {
  return `Hard cut to a new shot. ${closeUp.shot} ${CLOSE_UP_STYLE} Only ${guide.name}'s hands and forearms are in frame (white school-uniform shirt cuffs, sleeves rolled up): no face, no head and nothing above the elbows, and no face reflected in glass, screens or metal. The hands move slowly and carefully, the camera holds steady, and no legible text or logos appear.`;
}

// The player's own direction keeps the style, character and setting, so
// the video stays in the same world. The camera is left out on purpose:
// a request like "close-up of the socket" should be able to change it.
export function promptForDirection(
  direction: string,
  scene: Scene,
  guide: Guide,
): string {
  const text = direction.trim().replace(/[.\s]+$/, "");
  return `${STYLE} ${guide.description} is seated at the worktable in the middle of a PC build (current step: ${scene.title}). ${text}. ${setting(guide)}`;
}

// Dialogue lines may say `{guide}` where the speaker names themselves.
export function lineFor(line: string, guide: Guide): string {
  return line.replaceAll("{guide}", guide.name);
}

const closeUp = (step: string, shot: string): CloseUp => ({
  image: `/steps/${step}.jpg`,
  shot,
});

const part = (file: string, label: string): PartImage => ({
  src: `/parts/${file}`,
  label,
});

// ── The scenes ───────────────────────────────────────────────────────

export const SCENES: ReadonlyArray<Scene> = [
  {
    id: "prologue",
    chapter: "Prologue",
    title: "Welcome to the workshop",
    lines: [
      "Welcome to the workshop! I'm {guide}, and today we're building your PC together. ♡",
      "The build: an **i5-14600K**, an **RTX 5060 Ti 16 GB**, **32 GB of DDR5-6000** and a **2 TB NVMe** drive, all in a **Montech XR** case.",
      "Plan on about **2 to 3 hours** for a first build. No rushing, okay?",
      "One promise before we start: your motherboard and case manuals are the final word on where things plug in. I'll tell you what to look for.",
      "Press **Next Step** when you're ready. Or type below if you'd like to see something different!",
    ],
    action:
      "waves warmly at the viewer with a bright smile from behind the empty worktable, a stack of sealed computer part boxes at one side,",
  },
  {
    id: "get-ready",
    chapter: "Step 1",
    title: "Get ready",
    lines: [
      "First, make the **Windows USB installer** on another PC. Microsoft's free Media Creation Tool walks you through it.",
      "Then clear a large table, open the boxes, and lay out the parts.",
      "Leave each part in its bag until you need it. They're safest in there!",
    ],
    action:
      "smiles and gestures over neatly arranged opened boxes of computer parts laid out across the worktable, a graphics card box, a motherboard box, a CPU box and a power supply box, with a USB flash drive beside a laptop,",
    build: closeUp("01", "Top-down three-quarter view of a large wooden table. Hands set down a small bag of screws next to neatly laid-out PC parts in their open boxes: a motherboard box, a graphics card box, a cooler box, a small RAM pack, an M.2 SSD pack, a power supply box, and a PC case box. A small magnetic screwdriver and a USB flash drive lie in the foreground."),
    part: part("01a-cpu-retail-box-intel-core-i5-14600k.jpg", "Intel Core i5-14600K"),
  },
  {
    id: "open-case",
    chapter: "Step 2",
    title: "Open the case",
    lines: [
      "Lay the case on its side. Unscrew the thumbscrews on the back and remove the **left (glass) panel**.",
      "Set the glass somewhere safe, standing on a towel.",
      "Remove the right side panel too. You'll need it off for cabling.",
      "Find the bag of screws and cables inside the case. Keep it! We'll need those later.",
    ],
    action:
      "carefully lifts the tempered glass side panel off a black mid-tower PC case lying on its side on the worktable, a folded towel ready beside it,",
    build: closeUp("02", "A black mid-tower PC case with a tempered-glass left panel lies on its side on the table. Two hands are unscrewing a thumbscrew on the back edge to remove the glass side panel. The glass panel already removed stands on a folded towel nearby. Sunlight streams across the empty interior of the case."),
    part: part("07-case-montech-xr.jpg", "Montech XR case"),
  },
  {
    id: "cpu",
    chapter: "Step 3",
    title: "Install the CPU",
    lines: [
      "Now the heart of the build: the CPU! It goes on the motherboard **outside the case**. Put the motherboard on top of its box.",
      "Look at the chip. The top has a **triangle** in one corner. The underside has flat gold contact pads and **no pins**. The pins are in the motherboard socket. Don't touch the pads!",
      "Find the **CPU socket**: the square with a metal lever and a plastic cap.",
      "Push the lever down and out to the side, then lift it. The metal frame lifts open. The plastic cap pops off on its own when you close the frame. **Keep the cap.**",
      "Hold the CPU by its edges. Match the **small triangle** on its corner to the triangle on the socket.",
      "Lower it straight down. It should drop in flat with no pressure. **Never push it.**",
      "Close the frame, push the lever down, and tuck it under the retention tab. It takes firm pressure. That's normal, I promise.",
    ],
    action:
      "holds a small square silver CPU chip delicately by its edges with both hands above a motherboard lying flat on its box on the worktable, the metal socket frame raised open,",
    build: closeUp("03", "Close-up of a motherboard resting on top of its box. One hand holds a small square Intel CPU by its edges, hovering just above the open square CPU socket; the other hand steadies the raised metal retention lever. A small golden triangle on the CPU corner lines up with the triangle on the socket. Soft light glints on the golden socket pins. Emphasize gentleness and precision."),
    part: part("01b-cpu-chip-top-intel-core-i5-13600k-lga1700.jpg", "CPU top (corner triangle)"),
  },
  {
    id: "ram",
    chapter: "Step 4",
    title: "Install the RAM",
    lines: [
      "Memory next! Open the clips at the ends of the RAM slots.",
      "For two sticks, use the slots your motherboard manual says. On this board that's **A2 and B2**, the 2nd and 4th slots counting from the CPU.",
      "The notch in the stick is off-center. Match it to the key in the slot.",
      "Press down firmly on both ends until the clips **click** shut.",
    ],
    action:
      "presses a long black DDR5 memory stick down into a slot on the motherboard with both thumbs, a second memory stick waiting beside it,",
    build: closeUp("04", "Close-up of a motherboard on the table. Two hands press a black DDR5 RAM stick straight down into the second memory slot, thumbs on both ends. The slot clips on the sides are open, and a second stick sits ready beside it. A subtle motion line suggests the click as it seats."),
    part: part("04-ram-silicon-power-value-gaming-32gb-ddr5-6000.jpg", "32 GB DDR5-6000"),
  },
  {
    id: "ssd",
    chapter: "Step 5",
    title: "Install the M.2 SSD",
    lines: [
      "Storage time. Find the M.2 slot closest to the CPU, marked **M.2_1**. It usually has a metal heatsink cover.",
      "Unscrew the heatsink, and peel the plastic film from the thermal pad.",
      "Insert the SSD at a shallow angle, about **30 degrees**. It only goes in one way.",
      "Press it flat and fasten it with the small screw at the end. Then put the heatsink back on and screw it down.",
    ],
    action:
      "slides a small slim M.2 NVMe SSD stick into a slot on the motherboard at a shallow angle, a small screwdriver and a metal heatsink cover beside it,",
    build: closeUp("05", "Close-up of the area of the motherboard near the CPU socket. A hand holds a slim M.2 SSD stick at a shallow angle, sliding it into the M.2 slot, while the other hand holds a tiny screwdriver. The metal heatsink cover is unscrewed and set aside, with a thin peeled plastic film lying beside it."),
    part: part("05-storage-silicon-power-ud90-2tb.jpg", "UD90 2 TB NVMe"),
  },
  {
    id: "cooler",
    chapter: "Step 6",
    title: "Install the CPU cooler",
    lines: [
      "The CPU cooler! First, and please don't skip this: **remove the plastic film** from the bottom of the cooler.",
      "If the cooler has pre-applied paste, don't add any. If it doesn't, put a **pea-size dot** of thermal paste in the center of the CPU.",
      "Follow the cooler's manual for **Intel LGA1700** mounting. In general: fit the LGA1700 bracket or backplate, set the cooler on the CPU, and tighten the screws in a **cross pattern**, a little at a time.",
      "Attach the fan(s) with the metal clips if they aren't on already. Check the box for how many came with it.",
      "Turn the fan so the air moves from the front of the case to the back, **toward the rear fan**.",
      "Plug the fan cable into the **CPU_FAN** header, near the top of the CPU socket.",
      "It's a big one: 157 mm tall, dual tower. Check it doesn't press on the RAM. If it does, slide the fan up its clips or move it. And check the side panel will close over it.",
    ],
    action:
      "lowers a large dual-tower silver CPU air cooler with black fans onto the CPU on the motherboard, holding it level with both hands,",
    build: closeUp("06", "The motherboard on the table with the CPU installed. Two hands lower a large dual-tower black and silver CPU cooler with a fan onto the CPU socket. A hand holds a screwdriver tightening one mounting screw, with other screws in a cross pattern visible. A small thermal paste syringe lies on the table. A peeled plastic film is next to it."),
    part: part("02-cooler-id-cooling-frozn-a620-pro-se.jpg", "FROZN A620 PRO SE"),
  },
  {
    id: "prepare-case",
    chapter: "Step 7",
    title: "Prepare the case",
    lines: [
      "Back to the case. On the motherboard tray, the **standoffs** are the small brass screws that lift the motherboard.",
      "Match their positions to the **ATX** holes in your board. Add or move any that are missing.",
      "If your board came with a separate I/O shield, snap it into the rear opening. The TUF B760-PLUS WIFI has a built-in one, so we're set!",
      "Route the case's front-panel wires out of the way so they don't get caught.",
    ],
    action:
      "reaches into the open black PC case lying on its side on the worktable and screws a small brass standoff into the motherboard tray with careful fingertips,",
    build: closeUp("07", "Looking into the open case on its side, showing the bare motherboard tray. A hand uses a small nut driver to tighten a brass standoff screw into the tray. Several other brass standoffs are already in place in a neat grid pattern. Case wires are gently bundled aside. Warm light falls across the metal tray."),
    part: part("07-case-montech-xr.jpg", "Montech XR case"),
  },
  {
    id: "motherboard",
    chapter: "Step 8",
    title: "Install the motherboard",
    lines: [
      "Into the case it goes! Lower the motherboard in at a slight angle, so the rear ports slide into the opening.",
      "Line the screw holes up with the standoffs. Make sure no standoff touches the board where there's no hole.",
      "Screw in the board using all the screws provided, starting from the center and working outward. Snug, not hard.",
    ],
    action:
      "lowers a motherboard with a large CPU cooler and memory installed into the open PC case at a slight angle, guiding it into place with both hands,",
    build: closeUp("08", "Close-up of the open case. Two hands lower the motherboard, with the cooler and RAM already mounted, into the case at a slight angle, with the rear ports sliding into the rear opening. A small cup of screws sits on the case edge. Soft light glints on the board's heatsinks."),
    part: part("03-motherboard-asus-tuf-b760-plus-wifi.jpg", "TUF GAMING B760-PLUS WIFI"),
  },
  {
    id: "psu",
    chapter: "Step 9",
    title: "Install the power supply",
    lines: [
      "Power supply! Plug in the **modular cables** you need: the 24-pin, the 8-pin CPU (EPS), and the GPU power cable. You can also wait until the PSU is mounted.",
      "Slide the PSU into the bottom of the case with the **fan facing down**, toward the case vent, and the plug end facing out the back.",
      "Fasten it with four screws.",
    ],
    action:
      "slides a black modular power supply unit into the bottom of the PC case with its fan facing down, bundles of black cables resting beside it,",
    build: closeUp("09", "The open case with the motherboard installed. Two hands slide a black modular power supply into the bottom chamber of the case with its plug end facing the rear. A neat bundle of black modular cables with connectors lies on the table beside the case."),
    part: part("08-psu-msi-mag-a750gl-pcie5.jpg", "MSI MAG A750GL PCIE5"),
  },
  {
    id: "gpu",
    chapter: "Step 10",
    title: "Install the graphics card",
    lines: [
      "The graphics card, the star of the show! Remove the **PCIe slot covers** on the back of the case that match the top PCIe x16 slot. Usually 2 or 3.",
      "Open the clip at the end of the top PCIe x16 slot.",
      "Line up the card, then push straight down until it **clicks**.",
      "Screw the card's bracket to the case with the same screws you removed.",
    ],
    action:
      "holds a large dual-fan graphics card with both hands and lowers it into the top PCIe slot of the motherboard inside the PC case,",
    build: closeUp("10", "The open case seen from the side. Two hands hold a large dark gaming graphics card with two fans, lowering it straight down into the top PCIe slot. The metal slot covers on the back of the case have been removed and lie on the table. Light catches the fans and the metal edge of the card."),
    part: part("06-gpu-asus-prime-rtx-5060-ti-16gb.jpg", "PRIME RTX 5060 Ti 16 GB"),
  },
  {
    id: "power-cables",
    chapter: "Step 11",
    title: "Connect the power cables",
    lines: [
      "Power cables. Plug these in with the PSU switched **off**.",
      "**24-pin ATX:** the big connector on the right edge of the motherboard. It pushes in with a click.",
      "**8-pin CPU (EPS):** top-left of the motherboard, near the CPU. Use the cable labeled CPU, **not** the PCIe cable.",
      "**GPU power:** on the edge of the graphics card. Either 8-pin PCIe or 16-pin 12V-2x6, depending on your model. Push it in fully until it clicks.",
      "The CPU and PCIe cables look similar, so don't mix them up! Use the labels on the PSU cables.",
    ],
    action:
      "pushes a wide 24-pin power cable connector firmly into the edge of the motherboard inside the PC case, several black power cables draped neatly over the worktable,",
    build: closeUp("11", "Close-up of the inside of the open case. One hand pushes the wide 24-pin power connector into the edge of the motherboard, while the other hand holds the 8-pin CPU power cable ready near the top of the board. The graphics card power cable hangs ready nearby. The power supply switch visible at the back is turned off."),
  },
  {
    id: "front-panel",
    chapter: "Step 12",
    title: "Front panel and case cables",
    lines: [
      "The small, fiddly ones. Keep your motherboard manual's diagram open for the exact pin layout.",
      "**Front panel header (F_PANEL):** bottom-right of the board. Connect the case's **POWER SW**, **RESET SW**, **POWER LED** and **HDD LED**.",
      "The power switch matters most. LED polarity (+/-) only affects whether the light turns on.",
      "**Front USB 3.0:** the wide blue connector, into the **USB 3.2 Gen 1** header. It's keyed, so it only fits one way.",
      "**Front USB-C**, if the case has one: into the matching USB-C header. **HD Audio:** into the audio header on the lower-left of the board.",
      "**RGB and fan hubs:** if your case has a fan or RGB controller, connect it to the PSU and to a fan header or the 5V ARGB header (**3-pin**), as the case manual says.",
      "**Case fans:** plug each one into a **CHA_FAN** header, or into the case's fan hub if it has one.",
    ],
    action:
      "concentrates while plugging tiny front-panel connector wires onto pins at the bottom corner of the motherboard inside the PC case, a motherboard manual open beside the case,",
    build: closeUp("12", "Extreme close-up of the bottom-right corner of the motherboard, showing a block of small pins. Fingertips hold a tiny black front-panel connector with thin colored wires over the pins, holding it with tweezers and a small flashlight nearby. A neat tangle of small header cables is laid out in the foreground. Shallow depth of field."),
  },
  {
    id: "checklist",
    chapter: "Step 13",
    title: "Check everything",
    lines: [
      "Before closing up, a checklist! Cooler's plastic film removed, and its fan plugged into **CPU_FAN**?",
      "RAM clips clicked on both sides? SSD screwed down?",
      "24-pin and 8-pin CPU cables fully inserted? GPU power cable fully inserted?",
      "Front-panel connectors on the right pins?",
      "No loose screws, tools or bags inside the case? No cables touching any fan?",
      "All yes? Then it's time for the big moment.",
    ],
    action:
      "holds a clipboard and a pen, peering closely into the open PC case on the worktable and ticking items off a checklist,",
    build: closeUp("13", "A wide view of the open case, fully built, with all parts installed. One hand holds a small flashlight to shine into the case, while a pointing finger on the other hand gestures toward the RAM sticks. A small checklist card with blank tick boxes and no readable text lies on the table. Golden sunlight; a sense of calm care."),
  },
  {
    id: "first-boot",
    chapter: "Step 14",
    title: "First boot",
    lines: [
      "First boot! Do this **before** neat cable management, and leave the panels off so you can see inside.",
      "Plug the monitor into the **graphics card**, not the motherboard. Then plug in the keyboard and mouse.",
      "Plug the PSU into the wall, then flip the PSU switch to **I**.",
      "Press the case power button…",
      "You should see the fans spin and the **ASUS logo** or a BIOS screen within about 30 seconds. The first boot can take a bit longer while the RAM trains.",
      "If nothing shows on the screen, don't panic. Check the monitor cable is in the graphics card and every power cable is pushed all the way in, then see your motherboard manual's troubleshooting section.",
    ],
    action:
      "clasps both hands together excitedly as the fans inside the open PC case on the worktable begin to spin and glow, a monitor beside it lighting up with a boot logo,",
    build: closeUp("14", "A completed open-frame PC on the table, its fans spinning and its parts softly glowing. A hand presses the case power button. A monitor in the background shows a dark screen with an abstract bright logo shape (no real text). A keyboard and mouse sit nearby. The sun shines through the window with a hopeful glow."),
  },
  {
    id: "bios",
    chapter: "Step 15",
    title: "Set up the BIOS",
    lines: [
      "Let's peek into the BIOS. You may get a prompt on the first boot, or press **Delete** (or **F2**) while booting.",
      "Check the CPU, RAM and SSD are listed. The CPU should read **i5-14600K** and the RAM should show **32 GB**.",
      "Check the **BIOS version** is 1205 or newer. If it's older but the CPU is recognized, update later through EZ Flash in the BIOS.",
      "Enable **XMP**: on the Ai Tweaker or Extreme Tweaker page, set **Ai Overclock Tuner** to **XMP I** (or press F11 / use the EZ Mode prompt). That runs the RAM at 6000 MHz instead of a slower default.",
      "Confirm the CPU fan speed is shown and the CPU temperature is reasonable: under about **50 C** when idle.",
      "Then **save and exit** with F10.",
    ],
    action:
      "types on a keyboard at the worktable while looking at a monitor showing a blue BIOS settings screen, the open PC case glowing beside the monitor,",
    build: closeUp("15", "A close-up of a keyboard on the table with one hand pressing the Delete key and the other resting beside it. Behind it, a monitor shows a stylized dark-blue BIOS settings screen made of abstract bars and tiny unreadable text blocks, with a highlighted menu row. Soft screen glow mixes with the sunlight. No face reflected in the screen."),
  },
  {
    id: "windows",
    chapter: "Step 16",
    title: "Install Windows",
    lines: [
      "Time for Windows! Plug in the Windows USB, restart, and press **F8** to open the boot menu. Choose the USB drive.",
      "Follow the installer. When asked for a product key, enter yours, or choose \"I don't have a product key\" to activate later.",
      "Choose **Custom: Install Windows only**, select the entire 2 TB drive, and click Next.",
      "The PC restarts a few times. **Remove the USB drive** after the first restart, and let it boot into Windows.",
      "Finish the setup, including network and your account.",
    ],
    action:
      "plugs a USB flash drive into the front of the PC case while a monitor on the worktable shows an operating system installation screen,",
    build: closeUp("16", "A hand inserting a small USB flash drive into the front USB port of the PC case, while the other hand rests on a mouse. In the background a monitor shows a generic blue installation screen with a progress bar and an abstract window-shaped icon, no real text or logos. A thin glow runs along the PC's edges."),
  },
  {
    id: "drivers",
    chapter: "Step 17",
    title: "Drivers and updates",
    lines: [
      "Almost there! Connect to the internet, Ethernet or Wi-Fi.",
      "Run **Windows Update** until nothing is left. Restart as needed.",
      "Install the **NVIDIA driver** for the RTX 5060 Ti from nvidia.com, or the NVIDIA app.",
      "From the ASUS support page for the TUF GAMING B760-PLUS WIFI, install the **chipset, LAN, Wi-Fi, Bluetooth and audio** drivers if Windows didn't install them.",
      "Optional: check temperatures with a free tool such as HWiNFO, and run a game or benchmark for 15 minutes. CPU and GPU temps should stay below about **85 C**.",
    ],
    action:
      "watches a progress bar on the monitor with one hand on the mouse, a mug of tea beside the keyboard and the PC glowing softly next to the monitor,",
    build: closeUp("17", "Two hands typing on a keyboard in front of a monitor that shows a clean desktop with a small glowing graph window showing CPU and GPU temperature lines, plus a download progress bar. The PC sits beside it, fans quietly glowing. Warm light and a pink petal drifting on the desk."),
  },
  {
    id: "tidy-up",
    chapter: "Step 18",
    title: "Tidy up and close the case",
    lines: [
      "Last step! Switch the PSU off and unplug it.",
      "Route cables behind the motherboard tray and tie them with zip ties or velcro straps. Leave slack on the connectors.",
      "Make sure no cables touch the fans or the CPU cooler.",
      "Put the side panels back and fasten the thumbscrews.",
      "Plug everything back in. And… you're done! You built a PC!",
    ],
    action:
      "gently fits the tempered glass side panel back onto the finished PC case, neat cables visible inside, smiling proudly,",
    build: closeUp("18", "The finished PC standing upright on the table. One hand holds the tempered-glass side panel against the case while the other turns a thumbscrew at the back. Through the glass, the tidy interior shows neatly routed black cables and a glowing graphics card. A few pink petals float in the bright sunlit air. A sense of triumph."),
  },
  {
    id: "epilogue",
    chapter: "Epilogue",
    title: "After the build",
    lines: [
      "We did it! Thank you for building with me today. ♡",
      "Keep the receipts, boxes and manuals for warranty.",
      "Check in on your temperatures and fan noise after a week.",
      "And update the BIOS and GPU drivers every few months. Take good care of it, okay?",
    ],
    action:
      "sits beside the finished, softly glowing gaming PC on the worktable, giving a cheerful peace sign with a warm, proud smile,",
  },
];
