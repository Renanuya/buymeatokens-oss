"use server";

import { DRAFTS_PER_CREATOR_PER_DAY, aiProviders, hasSubstance, isDraftField, writeDraft } from "@/lib/ai-draft";
import { query } from "@/lib/db";
import { repoBrief } from "@/lib/github";
import { githubRepo, normalizeProjectUrl } from "@/lib/profile";
import { requireCreator } from "@/lib/session";

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
 * "Write with AI" on the project description: reads the public GitHub repo at `projectUrl` (the
 * saved link in the guided setup, the link as typed on the settings page) and drafts the field from its README.
 * Nothing is saved; the draft goes into the field for the creator to edit.
 */
export async function draftWithAiAction(field: unknown, projectUrl: unknown): Promise<DraftResult> {
  const user = await requireCreator();
  if (!isDraftField(field)) return { error: "Something went wrong. Reload the page and try again." };
  const providers = aiProviders();
  if (providers.length === 0) return { error: "AI drafts aren't available right now." };

  const link = normalizeProjectUrl(String(projectUrl ?? "").slice(0, 300));
  const url = "url" in link ? link.url : null;
  const repo = githubRepo(url);
  if (!repo) {
    return {
      error: url
        ? "AI drafts read a public GitHub repo. Link one in the project field to use them."
        : "Add your project's GitHub link first. The AI writes this from its README.",
    };
  }

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
