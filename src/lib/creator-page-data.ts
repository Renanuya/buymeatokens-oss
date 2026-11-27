import type { CreatorPageModel } from "@/components/creator-page";
import { isContributor } from "./contributors";
import { getStats, listRecentPaid, unitsSince } from "./donations";
import { repoStats } from "./github";
import { githubRepo } from "./profile";
import { hasPaymentMethod, type User } from "./users";

/** Everything the public page shows for `creator`, read from the database and GitHub. */
export async function loadCreatorPage(creator: User): Promise<CreatorPageModel> {
  const mode = creator.stripeMode ?? "live";
  const hasGoal = creator.goalUnits !== null && creator.goalStartedAt !== null;
  const repo = creator.projectUrl ? githubRepo(creator.projectUrl) : null;
  const [stats, recent, goalReached, repoInfo, contributor] = await Promise.all([
    getStats(creator.id, mode),
    listRecentPaid(creator.id, mode, 20),
    hasGoal ? unitsSince(creator.id, mode, creator.goalStartedAt!) : Promise.resolve(0),
    repo ? repoStats(repo) : Promise.resolve(null),
    isContributor(creator.login),
  ]);

  const name = creator.displayName || creator.username || "";
  const disabledReason = !hasPaymentMethod(creator)
    ? `${name} hasn't connected payments yet. Check back soon!`
    : null;

  return {
    username: creator.username ?? "",
    name,
    avatarUrl: creator.avatarUrl,
    bio: creator.bio,
    tokenUse: creator.tokenUse,
    thankYou: creator.thankYou,
    projectUrl: creator.projectUrl,
    projectName: creator.projectName,
    socials: creator.socials,
    unitPriceCents: creator.unitPriceCents,
    goal: hasGoal ? { units: creator.goalUnits!, reached: goalReached } : null,
    lifetimeFreeAt: creator.lifetimeFreeGrantedAt,
    contributor,
    stats: { units: stats.units, supporters: stats.supporters },
    repo: repoInfo,
    supporters: recent.map((d) => ({
      id: d.id,
      name: d.supporterName,
      units: d.units,
      message: d.message,
      at: d.paidAt ?? d.createdAt,
      reply: d.reply,
      repliedAt: d.repliedAt,
      likedAt: d.likedAt,
    })),
    payments: {
      cardEnabled: Boolean(creator.stripeKeyEnc),
      paypalEnabled: Boolean(creator.paypalEmail),
      usdcAddress: creator.usdcAddress,
      disabledReason,
    },
  };
}
