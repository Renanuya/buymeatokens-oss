// Sound effects for the landing page demo. The clips are from Mixkit's free sound effects
// (free for commercial use, no attribution needed) and live in /public/sounds.
// Sound starts off until the visitor opts in with the speaker button.
// The explicit preference is remembered per browser; audio also requires browser user activation.

export type SoundName = "select" | "press" | "success" | "coins";

const FILES: Record<SoundName, string> = {
  select: "/sounds/select.mp3", // Mixkit "Select click"
  press: "/sounds/press.mp3", // Mixkit "Interface option select"
  success: "/sounds/success.mp3", // Mixkit "Coin win notification"
  coins: "/sounds/coins.mp3", // Mixkit "Clinking coins"
};
const VOLUME: Record<SoundName, number> = { select: 0.6, press: 0.65, success: 0.8, coins: 0.85 };
const NAMES = Object.keys(FILES) as SoundName[];

const KEY = "bmt_sound";
const listeners = new Set<() => void>();
const files = new Map<SoundName, Promise<ArrayBuffer | null>>();
const buffers = new Map<SoundName, AudioBuffer>();
let ctx: AudioContext | null = null;
let decoding: Promise<void> | null = null;
let enabled = false;

const notify = () => listeners.forEach((fn) => fn());

export function soundOn(): boolean {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "on" || stored === "off") enabled = stored === "on";
  } catch {
    // Keep the in-memory preference when storage is unavailable.
  }
  return enabled;
}

/** Has the visitor clicked, tapped or typed on the page yet? Browsers block audio until then. */
export function audioAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : ctx?.state === "running";
}

/** Sound will actually be heard: allowed by the browser and not muted. */
export function soundReady(): boolean {
  return soundOn() && audioAllowed();
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the choice just won't persist.
  }
  if (on) unlockAudio();
  notify();
}

/** Called whenever sound becomes possible or the mute setting changes. */
export function onSoundChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Downloads the clips (no audio context needed), so they're ready the moment sound is allowed. */
export function prefetchSounds() {
  if (typeof window === "undefined") return;
  for (const name of NAMES) {
    if (!files.has(name)) {
      files.set(
        name,
        fetch(FILES[name])
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .catch(() => null),
      );
    }
  }
}

function decodeAll(c: AudioContext) {
  if (decoding) return decoding;
  prefetchSounds();
  decoding = Promise.all(
    NAMES.map(async (name) => {
      const data = await files.get(name);
      if (!data) return;
      try {
        // Copy: some browsers detach the buffer they decode.
        buffers.set(name, await c.decodeAudioData(data.slice(0)));
      } catch {
        // A clip that fails to decode just stays silent.
      }
    }),
  ).then(() => undefined);
  return decoding;
}

/** Call from a click, tap or key press: starts the audio engine and decodes the clips. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    ctx.addEventListener("statechange", notify);
  }
  if (ctx.state === "suspended") void ctx.resume().then(notify, () => undefined);
  void decodeAll(ctx);
  notify();
}

export function play(name: SoundName) {
  if (typeof window === "undefined" || !soundReady()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!ctx || ctx.state !== "running") {
    unlockAudio();
    return;
  }
  const buffer = buffers.get(name);
  if (!buffer) {
    void decodeAll(ctx);
    return;
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = VOLUME[name];
  source.connect(gain).connect(ctx.destination);
  source.start();
}
