// The landing intro (src/components/preloader.tsx) plays once per tab. sessionStorage lasts as long as the tab, reloads
// included, and a new tab starts empty. The head script reads the flag before the first paint, so a reload or a full
// page load never shows the intro, not even for a frame; the preloader component reads it again after hydration.

export const INTRO_KEY = "bmt_intro_played";

/**
 * The inline script for <head>: `bmt-intro-seen` hides the preloader in CSS, and `bmt-ready` lets the hero reveal start
 * at once. When storage is blocked it does nothing, and the intro may play again on a reload.
 */
export const INTRO_SCRIPT = `try{if(sessionStorage.getItem("${INTRO_KEY}")==="1")document.documentElement.classList.add("bmt-intro-seen","bmt-ready")}catch(e){}`;

/** Whether the intro already played in this tab: earlier in this document, or before a reload. */
export function introAlreadyPlayed(): boolean {
  if (document.documentElement.classList.contains("bmt-ready")) return true;
  try {
    return sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroPlayed() {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage blocked: the intro may play again on a reload, which is fine.
  }
}
