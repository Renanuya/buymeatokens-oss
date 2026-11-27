"use server";

import {
  DRAFTS_PER_CREATOR_PER_DAY,
  aiProviders,
  hasFacts,
  hasSubstance,
  isDraftField,
  writeDraft,
  type AiProvider,
  type DraftField,
} from "@/lib/ai-draft";
import { getApplicationForUser } from "@/lib/applications";
import { query } from "@/lib/db";
import { repoBrief } from "@/lib/github";
import { githubRepo, normalizeProjectUrl } from "@/lib/profile";
import { requireCreator } from "@/lib/session";
import type { User } from "@/lib/users";

export type DraftResult = { text: string; repo: string } | { error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Drafts everyone together can ask for in 24 hours; keeps the shared free quotas from running dry. */
function dailyCap(): number {
  const cap = Number(process.env.AI_DRAFTS_DAILY_CAP);
  return Number.isInteger(cap) && cap > 0 ? cap : 1_000;
}

/** Takes one draft from today's allowance, or says which limit is reached. */
async function reserveDraft(userId: string, field: string, repo: string): Promise<{ id: number } | { error: string }> {
  const now = Date.now();
  const since = now - DAY_MS;
  const { rows } = await query(
    `INSERT INTO ai_drafts (user_id, field, repo, created_at)
     SELECT ?, ?, ?, ?
     WHERE (SELECT count(*) FROM ai_drafts WHERE user_id = ? AND created_at > ?) < ?
       AND (SELECT count(*) FROM ai_drafts WHERE created_at > ?) < ?
     RETURNING id`,
    [userId, field, repo, now, userId, since, DRAFTS_PER_CREATOR_PER_DAY, since, dailyCap()],
  );
  if (rows[0]) return { id: Number(rows[0].id) };
  const mine = await query("SELECT count(*)::int AS n FROM ai_drafts WHERE user_id = ? AND created_at > ?", [userId, since]);
  return Number(mine.rows[0]?.n ?? 0) >= DRAFTS_PER_CREATOR_PER_DAY
    ? { error: `You've used today's ${DRAFTS_PER_CREATOR_PER_DAY} AI drafts. You can write it yourself, or try again tomorrow.` }
    : { error: "AI drafts are resting for today. You can write it yourself, or try again tomorrow." };
}

/** A draft that never reached the creator doesn't count against them. */
async function refund(id: number) {
  await query("DELETE FROM ai_drafts WHERE id = ?", [id]).catch(() => undefined);
}

/**
 * Without a GitHub repo: drafts from what the signed-in creator has saved (project name and link, their application,
 * token use). Nothing comes from the client and no link is fetched, so this can't be used as a general text generator.
 */
async function draftFromSavedDetails(user: User, field: DraftField, providers: AiProvider[]): Promise<DraftResult> {
  const application = await getApplicationForUser(user.id).catch(() => null);
  const facts = {
    name: user.projectName ?? application?.projectName ?? "",
    url: user.projectUrl ?? application?.projectUrl ?? "",
    description: application?.description ?? "",
    tokenUse: user.tokenUse || application?.tokenUse || "",
  };
  if (!hasFacts(facts)) return { error: "Add your project's name or link in the Project step first, so the AI has something to write from." };

  const reserved = await reserveDraft(user.id, field, "");
  if ("error" in reserved) return reserved;
  const draft = await writeDraft(field, facts, { providers });
  if (!draft) {
    await refund(reserved.id);
    return { error: "The AI is busy right now. Try again in a minute, or write it yourself." };
  }
  await query("UPDATE ai_drafts SET provider = ? WHERE id = ?", [draft.provider, reserved.id]).catch(() => undefined);
  return { text: draft.text, repo: "your project details" };
}

/**
 * "Write with AI" on the project description. With a public GitHub repo at `projectUrl` (the saved link in the guided
 * setup, the link as typed on the settings page) it drafts from the repo's README; without one, from the creator's
 * saved project details. Nothing is saved; the draft goes into the field for the creator to edit.
 */
export async function draftWithAiAction(field: unknown, projectUrl: unknown): Promise<DraftResult> {
  const user = await requireCreator();
  if (!isDraftField(field)) return { error: "Something went wrong. Reload the page and try again." };
  const providers = aiProviders();
  if (providers.length === 0) return { error: "AI drafts aren't available right now." };

  const link = normalizeProjectUrl(String(projectUrl ?? "").slice(0, 300));
  const repo = githubRepo("url" in link ? link.url : null);
  if (!repo) return draftFromSavedDetails(user, field, providers);

  const reserved = await reserveDraft(user.id, field, repo);
  if ("error" in reserved) return reserved;

  const brief = await repoBrief(repo);
  if (!brief) {
    await refund(reserved.id);
    return { error: `We couldn't read ${repo}. Check that the repo exists and is public, then try again.` };
  }
  if (!hasSubstance(brief)) {
    await refund(reserved.id);
    return { error: `${repo} has no README or description to write from yet.` };
  }

  const draft = await writeDraft(field, brief, { providers });
  if (!draft) {
    await refund(reserved.id);
    return { error: "The AI is busy right now. Try again in a minute, or write it yourself." };
  }
  await query("UPDATE ai_drafts SET provider = ? WHERE id = ?", [draft.provider, reserved.id]).catch(() => undefined);
  return { text: draft.text, repo: brief.fullName };
}
