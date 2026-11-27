"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import type { CreatorPageModel } from "@/components/creator-page";
import { FormMessage, type ActionState } from "@/components/form-message";
import { Glyph } from "@/components/glyph";
import {
  DescriptionField,
  GoalField,
  PriceField,
  ProjectFields,
  SocialFields,
  ThankYouField,
  TokenUseField,
} from "@/components/profile-fields";
import { SubmitButton } from "@/components/submit-button";
import type { RepoSuggestion } from "@/lib/github";
import type { Socials } from "@/lib/socials";
import { updateProfileAction } from "../actions";
import { PagePreview, draftPage } from "./page-preview";

export type ProfileDefaults = {
  displayName: string;
  bio: string;
  priceUsd: number;
  projectUrl: string;
  projectName: string;
  tokenUse: string;
  thankYou: string;
  goalUnits: number | null;
  socials: Socials;
};

// `first` is a prop rather than a :first-child style: React puts hidden action inputs at the top of the form.
function Section({ title, hint, first = false, children }: { title: string; hint?: string; first?: boolean; children: ReactNode }) {
  return (
    <section className={`grid grid-cols-1 gap-5 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 ${first ? "" : "border-t border-line pt-8"}`}>
      <div>
        <h2 className="font-display text-lg font-semibold tracking-[-0.03em]">{title}</h2>
        {hint && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      <div className="min-w-0 space-y-6">{children}</div>
    </section>
  );
}

export function ProfileForm({
  defaults,
  repos,
  page,
  aiDrafts,
}: {
  defaults: ProfileDefaults;
  repos: RepoSuggestion[];
  /** The saved public page, which the preview shows with the form's unsaved values on top. */
  page: CreatorPageModel;
  /** Whether "Write with AI" shows on the description field. */
  aiDrafts: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, {});
  const [displayName, setDisplayName] = useState(defaults.displayName);
  const [priceUsd, setPriceUsd] = useState<number | null>(defaults.priceUsd);
  // AI drafts read the project link as typed, saved or not.
  const [projectUrl, setProjectUrl] = useState(defaults.projectUrl);
  const ai = aiDrafts ? { projectUrl } : undefined;
  const form = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<CreatorPageModel | null>(null);

  return (
    <form ref={form} action={action} className="card max-w-4xl space-y-8 p-5 sm:p-8">
      <Section first title="Basics" hint="Your name and what supporters pay.">
        <div>
          <label htmlFor="displayName" className="label">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={60}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="field"
          />
        </div>
        <PriceField defaultValue={defaults.priceUsd} onValueChange={setPriceUsd} />
      </Section>

      <Section title="Project" hint="The repo or site supporters are funding. Shown at the top of your page.">
        <ProjectFields
          defaultUrl={defaults.projectUrl}
          defaultName={defaults.projectName}
          repos={repos}
          onValueChange={(project) => setProjectUrl(project.url)}
        />
        <DescriptionField defaultValue={defaults.bio} ai={ai} />
        <TokenUseField defaultValue={defaults.tokenUse} />
        <ThankYouField defaultValue={defaults.thankYou} />
      </Section>

      <Section title="Goal" hint="A progress bar on your page. It counts from the day you set it.">
        <GoalField defaultValue={defaults.goalUnits} priceUsd={priceUsd ?? defaults.priceUsd} />
      </Section>

      <Section title="Links" hint="Shown under your name. Leave a field empty to remove it.">
        <SocialFields defaultValue={defaults.socials} />
      </Section>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 space-y-3 rounded-b-2xl border-t border-line bg-white/95 px-5 py-4 backdrop-blur max-[360px]:px-3 sm:-mx-8 sm:-mb-8 sm:px-8 sm:py-5">
        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-2.5 max-[360px]:grid max-[360px]:grid-cols-2 max-[360px]:gap-2">
          <SubmitButton pendingText="Saving…" className="btn-dark max-[360px]:px-2">
            Save changes
          </SubmitButton>
          <button
            type="button"
            onClick={() => form.current && setPreview(draftPage(page, new FormData(form.current)))}
            className="btn-line h-12 gap-2 py-0 max-[360px]:px-2"
          >
            <Glyph name="eye" className="size-4" />
            Preview
          </button>
          <p className="hidden text-xs text-muted sm:block">See your page with these changes before you save.</p>
        </div>
      </div>
      {preview && (
        <PagePreview
          page={preview}
          onClose={() => setPreview(null)}
          onSave={() => {
            setPreview(null);
            form.current?.requestSubmit();
          }}
        />
      )}
    </form>
  );
}
