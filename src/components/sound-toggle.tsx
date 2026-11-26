"use client";

import { useEffect, useState } from "react";
import { onSoundChange, setSoundOn, soundOn } from "@/lib/sound";

/** Speaker button that mutes or unmutes the demo's sound effects (remembered per browser). */
export function SoundToggle({ className = "", dark = false, onEnable }: {
  className?: string;
  dark?: boolean;
  onEnable?: () => void;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(soundOn());
    return onSoundChange(() => setOn(soundOn()));
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        setSoundOn(!on);
        if (!on) onEnable?.();
      }}
      aria-pressed={on}
      aria-label={on ? "Mute sound effects" : "Turn sound effects on"}
      title={on ? "Mute sound effects" : "Turn sound effects on"}
      className={`grid size-9 shrink-0 place-items-center rounded-full transition ${
        dark ? "border border-white/15 text-white/80 hover:bg-white/10" : "text-ink hover:bg-ink/5"
      } ${className}`}
    >
      <svg viewBox="0 0 20 20" fill="none" className="size-[18px]" aria-hidden>
        <path d="M3.5 7.5h2.75L10 4.5v11l-3.75-3H3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        {on ? (
          <>
            <path d="M13 7.25a3.5 3.5 0 0 1 0 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M15.25 5a6.5 6.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <path d="m13.5 8 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
