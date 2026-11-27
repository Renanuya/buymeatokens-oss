"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLeaderboardAction } from "./actions";

/** The switch for "Show my project on the leaderboard". Saves at once, like the email switch. */
export function LeaderboardToggle({ on }: { on: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-label="Show my project on the leaderboard"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setFailed(false);
            setShown(!shown);
            const result = await setLeaderboardAction(!shown);
            if (!result.ok) setFailed(true);
          })
        }
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris disabled:cursor-wait ${
          shown ? "bg-iris" : "bg-line"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
            shown ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {failed && <p role="alert" className="text-xs text-red-600">Not saved. Try again.</p>}
    </div>
  );
}
