"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppHeader } from "@/components/app-header";
import { CreatorPageBody, type CreatorPageModel } from "@/components/creator-page";
import { Glyph } from "@/components/glyph";
import { ArrowUpRight } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { githubRepo, normalizeProjectUrl, parseGoalUnits, parsePriceUsd, parseThankYou, projectNameFromUrl } from "@/lib/profile";
import { socialsFromForm } from "@/lib/socials";
import { previewRepoStatsAction } from "./preview-actions";

/** The saved page with the form's unsaved values on top. Invalid values fall back to what's saved. */
export function draftPage(saved: CreatorPageModel, form: FormData): CreatorPageModel {
  const name = String(form.get("displayName") ?? "").trim() || saved.name;
  const price = parsePriceUsd(form.get("price"));
  const link = normalizeProjectUrl(String(form.get("projectUrl") ?? ""));
  const projectUrl = "url" in link ? link.url : saved.projectUrl;
  const projectName = projectUrl ? String(form.get("projectName") ?? "").trim() || projectNameFromUrl(projectUrl) : null;
  const goal = parseGoalUnits(form.get("goal"));
  const goalUnits = "units" in goal ? goal.units : (saved.goal?.units ?? null);
  const thanks = parseThankYou(form.get("thankYou") ?? saved.thankYou);
  const socials = socialsFromForm(form);
  const sameRepo = Boolean(projectUrl && saved.projectUrl && githubRepo(projectUrl) === githubRepo(saved.projectUrl));
  return {
    ...saved,
    name,
    unitPriceCents: price ? price * 100 : saved.unitPriceCents,
    bio: String(form.get("bio") ?? saved.bio),
    tokenUse: String(form.get("tokenUse") ?? saved.tokenUse),
    thankYou: "text" in thanks ? thanks.text : saved.thankYou,
    projectUrl,
    projectName,
    repo: sameRepo ? saved.repo : null,
    goal: goalUnits ? { units: goalUnits, reached: saved.goal?.reached ?? 0 } : null,
    socials: "socials" in socials ? socials.socials : saved.socials,
  };
}

/**
 * Full-screen preview of the public page with unsaved changes, rendered by the same component as the real page.
 * Only paying is switched off.
 */
export function PagePreview({ page, onClose, onSave }: { page: CreatorPageModel; onClose: () => void; onSave: () => void }) {
  const [shown, setShown] = useState(page);

  // A project link that differs from the saved one gets its GitHub numbers fetched for the preview.
  useEffect(() => {
    setShown(page);
    if (!page.projectUrl || page.repo || !githubRepo(page.projectUrl)) return;
    let live = true;
    previewRepoStatsAction(page.projectUrl)
      .then((repo) => live && setShown((p) => ({ ...p, repo })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [page]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Page preview" className="rise-in fixed inset-0 z-50 flex flex-col bg-paper">
      <div className="flex items-center gap-3 bg-night px-4 py-3 text-white sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold max-[400px]:p-2">
          <Glyph name="eye" className="size-4 text-fuel" />
          <span className="max-[400px]:sr-only">Preview</span>
        </span>
        <p className="hidden min-w-0 truncate text-sm text-white/65 md:block">
          Your page with the changes you haven&apos;t saved yet. Paying is switched off here.
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 px-4 text-[13px] font-semibold transition hover:border-white/50"
          >
            <Glyph name="arrow-left" strokeWidth={2} className="size-3.5" />
            <span className="hidden sm:inline">Back to editing</span>
            <span className="sm:hidden">Back</span>
          </button>
          <button type="button" onClick={onSave} className="btn-iris h-10 gap-2 px-4 py-0 text-[13px]">
            <Glyph name="check" strokeWidth={2.4} className="size-3.5" />
            Save changes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col">
          <AppHeader>
            <span className="link-arrow whitespace-nowrap">
              <span className="sm:hidden">Get yours</span>
              <span className="hidden sm:inline">Get your own page</span> <ArrowUpRight className="size-3" />
            </span>
          </AppHeader>
          <main className="wrap flex-1 pb-24">
            <CreatorPageBody page={shown} preview />
          </main>
          <footer className="border-t border-line">
            <div className="wrap flex h-16 items-center justify-between text-xs text-muted">
              <span className="inline-flex items-center gap-2 font-medium text-ink">
                <LogoMark className="size-5" /> Powered by buymeatokens
              </span>
              <span>0% platform fee</span>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
