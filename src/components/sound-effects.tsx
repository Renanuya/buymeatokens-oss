"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/sound";

// Sound is only used in the landing page demo. Browsers allow audio only after a click, tap or key press,
// so the first one anywhere on the site unlocks it for when the visitor reaches the demo.
export function SoundEffects() {
  useEffect(() => {
    // "click" rather than "pointerdown": unlocking mid-click would swap the demo's "Turn on sound" button
    // for the mute button before the click lands, and the click would go nowhere.
    const events = ["click", "touchend", "keydown"] as const;
    const unlock = () => {
      unlockAudio();
      events.forEach((e) => window.removeEventListener(e, unlock));
    };
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);
  return null;
}
