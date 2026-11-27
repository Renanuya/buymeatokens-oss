"use server";

import { appUrl } from "@/lib/config";
import { requireCreator } from "@/lib/session";
import type { SponsorStatus } from "@/lib/sponsor";
import { sponsorStatus } from "@/lib/sponsor-status";

/** Where the creator's GitHub Sponsor button stands. `pick` switches to another of their own repositories. */
export async function getSponsorStatus(pick?: string | null): Promise<SponsorStatus> {
  const user = await requireCreator();
  return sponsorStatus({
    username: user.username,
    login: user.login,
    projectUrl: user.projectUrl,
    host: new URL(appUrl()).host,
    pick: typeof pick === "string" ? pick : null,
  });
}
