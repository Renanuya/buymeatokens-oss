"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setDirectoryAction } from "../actions";

type Pick = { listed: boolean; category: string; language: string };

/** "List my project in the directory": saves at once, like the switches on the Account page. */
export function DirectoryCard({ initial, ready, categories, languages }: { initial: Pick; ready: boolean; categories: string[]; languages: string[] }) {
  const [saved, setSaved] = useState(initial);
  const [shown, setShown] = useOptimistic(saved);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const save = (next: Pick) =>
    start(async () => {
      setFailed(false);
      setShown(next);
      const result = await setDirectoryAction(next);
      if (result.ok) setSaved(next);
      else setFailed(true);
    });
  return (
    <section className="card max-w-4xl space-y-4 p-5 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">Project directory</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Let people find your project in the public directory. Off by default; you can unlist it any time.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={shown.listed}
          aria-label="List my project in the directory"
          disabled={pending}
          onClick={() => save({ ...shown, listed: !shown.listed })}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris disabled:cursor-wait ${
            shown.listed ? "bg-iris" : "bg-line"
          }`}
        >
          <span
            aria-hidden
            className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
              shown.listed ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="dir-category" className="label">Category</label>
          <select id="dir-category" value={shown.category} disabled={pending} onChange={(e) => save({ ...shown, category: e.target.value })} className="field h-11 py-0">
            <option value="">None</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="dir-language" className="label">Main language</label>
          <select id="dir-language" value={shown.language} disabled={pending} onChange={(e) => save({ ...shown, language: e.target.value })} className="field h-11 py-0">
            <option value="">None</option>
            {languages.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      {shown.listed && !ready && (
        <p className="text-xs text-muted">You will show up once your page has a project name or description and a payment method.</p>
      )}
      {failed && <p role="alert" className="text-xs text-red-600">Not saved. Try again.</p>}
    </section>
  );
}
