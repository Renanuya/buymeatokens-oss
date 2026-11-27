// The text on a creator's link preview card (src/app/[username]/opengraph-image.tsx), kept pure so it can be tested.

import { formatTokens, oneLine } from "./format";

/** The creator's name at a size that fits one line of the card: long names get smaller, very long ones are cut. */
export function cardName(name: string): { text: string; size: number } {
  const text = oneLine(name, 32) || "A creator";
  const length = Array.from(text).length;
  const size = length <= 12 ? 84 : length <= 18 ? 72 : length <= 24 ? 60 : 52;
  return { text, size };
}

/** Markdown down to plain words: links keep their text, images and formatting marks go. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~|]/g, "");
}

/** Up to two lines under the name: what they're building, and the start of their description. */
export function cardLines(creator: { projectName: string | null; bio: string }): string[] {
  const project = creator.projectName ? oneLine(`Building ${creator.projectName}`, 48) : "";
  const bio = oneLine(plainText(creator.bio), project ? 96 : 110);
  return [project, bio].filter(Boolean);
}

/** The bottom-left of the card: the goal's progress, or the totals, or an invitation. */
export type CardStats =
  | { kind: "goal"; label: string; percent: number }
  | { kind: "totals"; label: string }
  | { kind: "first"; label: string };

export function cardStats(input: {
  units: number;
  supporters: number;
  goal: { units: number; reached: number } | null;
}): CardStats {
  if (input.goal && input.goal.units > 0) {
    const percent = Math.max(0, Math.min(100, Math.round((input.goal.reached / input.goal.units) * 100)));
    return { kind: "goal", label: `${formatTokens(input.goal.reached)} of ${formatTokens(input.goal.units)} tokens`, percent };
  }
  if (input.units > 0) {
    const people = input.supporters === 1 ? "1 supporter" : `${input.supporters.toLocaleString("en-US")} supporters`;
    return { kind: "totals", label: `${formatTokens(input.units)} tokens from ${people}` };
  }
  return { kind: "first", label: "Be the first to buy me AI tokens" };
}
