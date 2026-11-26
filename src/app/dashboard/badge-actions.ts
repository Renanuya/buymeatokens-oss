"use server";

import { recordBadgeCopy, type BadgeStyle } from "@/lib/creator-activity";
import { requireCreator } from "@/lib/session";

export async function trackBadgeCopy(style: BadgeStyle): Promise<void> {
  if (style !== "button" && style !== "compact") return;
  const user = await requireCreator();
  await recordBadgeCopy(user.id, style);
}
