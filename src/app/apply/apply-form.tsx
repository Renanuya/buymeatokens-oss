"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { ArrowUpRight } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import type { RepoSuggestion } from "@/lib/github";
import { submitApplicationAction, type ApplyState } from "./actions";

type Defaults = {
  githubLogin?: string;
  email: string;
  projectName: string;
  projectUrl: string;
  description: string;
  tokenUse: string;
  payout: string[];
  country: string;
};

export function ApplyForm({
  defaults,
  repos,
  payoutOptions,
  askGithub = false,
}: {
  defaults: Defaults;
  repos: RepoSuggestion[];
  payoutOptions: readonly { value: string; label: string }[];
  /** Guests tell us their GitHub username instead of signing in. */
  askGithub?: boolean;
}) {
  const [state, action] = useActionState<ApplyState, FormData>(submitApplicationAction, {});
  const [projectName, setProjectName] = useState(defaults.projectName);
  const [projectUrl, setProjectUrl] = useState(defaults.projectUrl);
  // React resets a form after its action runs. On an error the action sends back what was typed,
  // and the fields use it as their default, so nothing gets wiped.
  const v = { ...defaults, ...state.values };

  return (
    <form action={action} className="card space-y-6 p-6 shadow-[0_30px_70px_-40px_rgba(28,28,30,0.35)] sm:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {askGithub && (
        <div>
          <label htmlFor="githubLogin" className="label">
            Your GitHub username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted">@</span>
            <input
              id="githubLogin"
              name="githubLogin"
              required
              maxLength={100}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              defaultValue={v.githubLogin}
              placeholder="octocat"
              className="field pl-8"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">No sign-up now. Once you&apos;re in, you log in with this account.</p>
        </div>
      )}

      <div>
        <label htmlFor="projectUrl" className="label">
          Project link
        </label>
        {repos.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {repos.map((r) => (
              <button
                key={r.url}
                type="button"
                onClick={() => {
                  setProjectUrl(r.url);
                  if (!projectName) setProjectName(r.name);
                }}
                className={`max-w-full rounded-full border px-3 py-1.5 text-left text-xs font-medium transition [overflow-wrap:anywhere] ${
                  projectUrl === r.url ? "border-iris bg-lilac-soft text-ink" : "border-line bg-white text-muted hover:text-ink"
                }`}
              >
                {r.name}
                {r.stars > 0 && <span className="ml-1.5 text-muted">★ {r.stars.toLocaleString("en-US")}</span>}
              </button>
            ))}
          </div>
        )}
        <input
          id="projectUrl"
          name="projectUrl"
          required
          value={projectUrl}
          onChange={(e) => setProjectUrl(e.target.value)}
          placeholder="https://github.com/you/your-project"
          className="field"
        />
      </div>

      <div>
        <label htmlFor="projectName" className="label">
          Project name
        </label>
        <input
          id="projectName"
          name="projectName"
          required
          maxLength={80}
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="description" className="label">
          What are you building?
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          maxLength={800}
          defaultValue={v.description}
          placeholder="A sentence or two: what it does and who uses it."
          className="field resize-y"
        />
      </div>

      <div>
        <label htmlFor="tokenUse" className="label">
          What would you spend the tokens on? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="tokenUse"
          name="tokenUse"
          rows={2}
          maxLength={500}
          defaultValue={v.tokenUse}
          placeholder="Claude for refactors, Cursor, running evals…"
          className="field resize-y"
        />
      </div>

      <fieldset>
        <legend className="label">How would you like to get paid?</legend>
        <div className="flex flex-wrap gap-2">
          {payoutOptions.map((p) => (
            <label key={p.value} className="cursor-pointer">
              <input
                type="checkbox"
                name="payout"
                value={p.value}
                defaultChecked={v.payout.includes(p.value)}
                className="peer sr-only"
              />
              <span className="inline-flex rounded-full border border-line bg-white px-3.5 py-2 text-sm text-muted transition peer-checked:border-iris peer-checked:bg-lilac-soft peer-checked:text-ink peer-focus-visible:ring-4 peer-focus-visible:ring-iris/15">
                {p.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" required defaultValue={v.email} className="field" />
        </div>
        <div>
          <label htmlFor="country" className="label">
            Country <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="country" name="country" maxLength={60} defaultValue={v.country} className="field" />
        </div>
      </div>

      <FormMessage state={state} />
      <SubmitButton pendingText="Sending…" className="btn-dark w-full justify-between py-4 pl-6 pr-5">
        Send application <ArrowUpRight />
      </SubmitButton>
    </form>
  );
}
