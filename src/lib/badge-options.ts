// README badge choices, kept apart from the renderer (src/lib/badge.ts) so the page that picks a badge doesn't
// load the embedded font.

export const BADGE_STYLES = ["button", "flat", "pill"] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];

export const BADGE_THEMES = ["dark", "light", "iris", "lilac"] as const;
export type BadgeTheme = (typeof BADGE_THEMES)[number];

export function parseBadgeStyle(value: string | null): BadgeStyle {
  return (BADGE_STYLES as readonly string[]).includes(value ?? "") ? (value as BadgeStyle) : "button";
}

export function parseBadgeTheme(value: string | null): BadgeTheme {
  return (BADGE_THEMES as readonly string[]).includes(value ?? "") ? (value as BadgeTheme) : "dark";
}

/** The query string for a badge URL, leaving out the defaults so the plain URL keeps working. */
export function badgeQuery(style: BadgeStyle, theme: BadgeTheme): string {
  const params = new URLSearchParams();
  if (style !== "button") params.set("style", style);
  if (theme !== "dark") params.set("theme", theme);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** The README supporter wall (src/lib/wall.ts) comes in two colours; README snippets can pick one per GitHub theme. */
export const WALL_THEMES = ["light", "dark"] as const;
export type WallTheme = (typeof WALL_THEMES)[number];

export function parseWallTheme(value: string | null): WallTheme {
  return value === "dark" ? "dark" : "light";
}
