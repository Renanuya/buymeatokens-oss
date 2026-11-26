"use server";

import { repoStats, type RepoStats } from "@/lib/github";
import { githubRepo, normalizeProjectUrl } from "@/lib/profile";
import { requireCreator } from "@/lib/session";

/** GitHub numbers for a project link typed in the page editor, so the preview can show them before saving. */
export async function previewRepoStatsAction(url: string): Promise<RepoStats | null> {
  await requireCreator();
  const link = normalizeProjectUrl(url);
  const repo = "url" in link && link.url ? githubRepo(link.url) : null;
  return repo ? repoStats(repo) : null;
}
