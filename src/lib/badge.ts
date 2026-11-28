import { INTER_TIGHT_600, INTER_TIGHT_700, type BadgeFont } from "./badge-font";
import type { BadgeStyle, BadgeTheme } from "./badge-options";

// README badges. Text is drawn as Inter Tight outlines, so the badge looks the same on GitHub, npm and
// everywhere else (SVGs shown as images can't load web fonts).

export const INK = "#1c1c1e";
export const LILAC = "#cdd2fb";
export const LILAC_SOFT = "#eef0fe";
export const IRIS = "#5b6cf2";
export const WHITE = "#ffffff";

// The </> mark and the ↗ arrow from the site, drawn on a 16×16 grid.
export const LOGO_PATH = "M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75";
export const ARROW_PATH = "M4.5 11.5 11.5 4.5M5.5 4.5h6v6";

/**
 * Colour sets. `bg`/`fg` are the badge and its label; `tile`/`tileInk` the round logo tile; `chip`/`chipInk` the
 * token count; `edge` a hairline that keeps the shape visible on backgrounds of the same colour. `goal` is the
 * fill of the goal bar: a colour in its own right per theme, so the bar stays visible on a white badge as well
 * as on a dark one (the chip colour is too pale on white).
 */
const THEMES = {
  dark: { bg: INK, fg: WHITE, tile: LILAC, tileInk: INK, chip: LILAC, chipInk: INK, edge: WHITE, edgeOpacity: 0.14, goal: LILAC },
  light: { bg: WHITE, fg: INK, tile: LILAC, tileInk: INK, chip: LILAC_SOFT, chipInk: IRIS, edge: INK, edgeOpacity: 0.14, goal: IRIS },
  iris: { bg: IRIS, fg: WHITE, tile: WHITE, tileInk: IRIS, chip: WHITE, chipInk: IRIS, edge: WHITE, edgeOpacity: 0.2, goal: WHITE },
  lilac: { bg: LILAC, fg: INK, tile: INK, tileInk: WHITE, chip: INK, chipInk: WHITE, edge: INK, edgeOpacity: 0.1, goal: IRIS },
} as const satisfies Record<BadgeTheme, unknown>;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export const esc = (value: string) => value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** Two decimals, so coordinates stay short and the SVG stays byte-identical between renders. */
export const n = (value: number) => String(Math.round(value * 100) / 100);

export interface Run {
  width: number;
  svg: (x: number, baseline: number, fill: string) => string;
}

/** Lay `text` out in `font` at `size`, as vector paths. `tracking` is in ems, added between letters. */
export function run(font: BadgeFont, text: string, size: number, tracking = 0): Run {
  const scale = size / font.unitsPerEm;
  const glyphs: { x: number; d: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < text.length; i++) {
    const [advance, d] = font.glyphs[text[i]] ?? font.glyphs["?"];
    if (d) glyphs.push({ x: cursor, d });
    cursor += advance + (font.kern[text[i] + (text[i + 1] ?? "")] ?? 0);
    if (i < text.length - 1) cursor += tracking * font.unitsPerEm;
  }
  return {
    width: cursor * scale,
    svg: (x, baseline, fill) =>
      `<g transform="translate(${n(x)} ${n(baseline)}) scale(${scale})" fill="${fill}">${glyphs
        .map((g) => `<path transform="translate(${Math.round(g.x)} 0)" d="${g.d}"/>`)
        .join("")}</g>`,
  };
}

/** Baseline that centers capital letters of `size` vertically around `centerY`. */
export function baselineFor(font: BadgeFont, size: number, centerY: number) {
  return centerY + (font.capHeight / font.unitsPerEm) * size * 0.5;
}

export function icon(path: string, x: number, y: number, size: number, color: string, strokeWidth: number) {
  return `<path transform="translate(${n(x)} ${n(y)}) scale(${n(size / 16)})" d="${path}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Wrap `body` in the outer `<svg>` with a `<title>` (the accessible name; the text itself is paths). */
export function wrap(width: number, height: number, title: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${height}" viewBox="0 0 ${n(width)} ${height}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
}

/** A filled badge: a background rounded rect, and a hairline so it reads on any background. */
function shape(width: number, height: number, radius: number, t: (typeof THEMES)[BadgeTheme]) {
  return (
    `<rect width="${n(width)}" height="${height}" rx="${radius}" fill="${t.bg}"/>` +
    `<rect x=".5" y=".5" width="${n(width - 1)}" height="${height - 1}" rx="${radius - 0.5}" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeOpacity}"/>`
  );
}

export function formatTokens(millions: number): string {
  if (!Number.isFinite(millions)) return "0M";
  return millions >= 1000 ? `${trim(millions / 1000)}B` : `${trim(millions)}M`;
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.?0+$/, "");
}

/** The button badge: [ </>  Buy me AI tokens  (12M tokens) ]. `count` is e.g. "12M tokens", or null. */
export function buttonBadge(count: string | null, t: (typeof THEMES)[BadgeTheme]): string {
  const label = run(INTER_TIGHT_600, "Buy me AI tokens", 14, -0.005);
  const chipText = count ? run(INTER_TIGHT_700, count, 12.5, -0.005) : null;
  const h = 36;
  const tile = 24;
  const pad = 6;
  const labelX = pad + tile + 10;
  const chipX = labelX + label.width + 12;
  const chipW = chipText ? chipText.width + 22 : 0;
  let width: number;
  let tail: string;
  if (count) {
    width = chipX + chipW + pad;
    tail =
      `<rect x="${n(chipX)}" y="${pad}" width="${n(chipW)}" height="${tile}" rx="${tile / 2}" fill="${t.chip}"/>` +
      chipText.svg(chipX + 11, baselineFor(INTER_TIGHT_700, 12.5, h / 2), t.chipInk);
  } else {
    const arrowX = labelX + label.width + 7;
    width = arrowX + 11 + 15;
    tail = icon(ARROW_PATH, arrowX, h / 2 - 5.5, 11, t.fg, 1.9);
  }
  const title = esc(count ? `Buy me AI tokens: ${count}` : "Buy me AI tokens");
  return wrap(
    width,
    h,
    title,
    shape(width, h, h / 2, t) +
      `<circle cx="${pad + tile / 2}" cy="18" r="${tile / 2}" fill="${t.tile}"/>` +
      icon(LOGO_PATH, pad + tile / 2 - 7, 11, 14, t.tileInk, 1.8) +
      label.svg(labelX, baselineFor(INTER_TIGHT_600, 14, 18), t.fg) +
      tail,
  );
}

/** The flat badge: [ </> buy me AI tokens | 12M tokens ] at 20px high, split down the middle. */
export function flatBadge(count: string | null, t: (typeof THEMES)[BadgeTheme]): string {
  const label = run(INTER_TIGHT_600, "buy me AI tokens", 11, 0.005);
  const shown = count ?? `${formatTokens(0)} tokens`;
  const value = run(INTER_TIGHT_700, shown, 11, 0.005);
  const h = 20;
  const pad = 6;
  const tile = 12;
  const labelX = pad + tile + 6;
  const split = labelX + label.width + 6;
  const width = split + 7 + value.width + 8;
  const title = esc(`buy me AI tokens: ${shown}`);
  return wrap(
    width,
    h,
    title,
    `<clipPath id="r"><rect width="${n(width)}" height="${h}" rx="4"/></clipPath>` +
      `<g clip-path="url(#r)"><rect width="${n(split)}" height="${h}" fill="${t.bg}"/><rect x="${n(split)}" width="${n(width - split)}" height="${h}" fill="${t.chip}"/></g>` +
      `<rect x=".5" y=".5" width="${n(width - 1)}" height="${h - 1}" rx="3.5" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeOpacity}"/>` +
      `<rect x="4" y="4" width="12" height="12" rx="3.5" fill="${t.tile}"/>` +
      icon(LOGO_PATH, 4.75, 4.75, 10.5, t.tileInk, 2) +
      label.svg(labelX, baselineFor(INTER_TIGHT_600, 11, h / 2), t.fg) +
      value.svg(split + 7, baselineFor(INTER_TIGHT_700, 11, h / 2), t.chipInk),
  );
}

/** The pill badge: [ </>  Buy me AI tokens | 12M ] at 28px high. The count loses its "tokens", as on the site. */
export function pillBadge(count: string | null, t: (typeof THEMES)[BadgeTheme]): string {
  const label = run(INTER_TIGHT_600, "Buy me AI tokens", 12.5, -0.005);
  const value = count ? run(INTER_TIGHT_700, count.replace(/ tokens$/, ""), 12.5, -0.005) : null;
  const h = 28;
  const tile = 20;
  const pad = 4;
  const labelX = pad + tile + 8;
  const dividerX = labelX + label.width + 10;
  const width = value ? dividerX + 1 + 10 + value.width + 12 : labelX + label.width + 12;
  const title = esc(count ? `Buy me AI tokens: ${count}` : "Buy me AI tokens");
  return wrap(
    width,
    h,
    title,
    shape(width, h, h / 2, t) +
      `<circle cx="${pad + tile / 2}" cy="${h / 2}" r="${tile / 2}" fill="${t.tile}"/>` +
      icon(LOGO_PATH, pad + tile / 2 - 6, h / 2 - 6, 12, t.tileInk, 1.9) +
      label.svg(labelX, baselineFor(INTER_TIGHT_600, 12.5, h / 2), t.fg) +
      (value
        ? `<rect x="${n(dividerX)}" y="8" width="1" height="12" fill="${t.fg}" fill-opacity=".25"/>` +
          value.svg(dividerX + 11, baselineFor(INTER_TIGHT_700, 12.5, h / 2), t.fg)
        : ""),
  );
}

/** `count` is e.g. "12M tokens", or null when the creator hasn't received support yet. "goal" and "supporters" need live data, so the badge route renders them with goalBadge/supportersBadge; here they fall back to the button. */
export function renderBadge(count: string | null, style: BadgeStyle = "button", theme: BadgeTheme = "dark"): string {
  const t = THEMES[theme];
  return style === "flat" ? flatBadge(count, t) : style === "pill" ? pillBadge(count, t) : buttonBadge(count, t);
}

/**
 * Goal progress, in the button layout: [ </>  Buy me AI tokens  (12M / 50M) ] with a progress bar under
 * the chip. `reached` and `goal` are millions of tokens; with no goal the badge falls back to the regular
 * button badge (with the token count). The percentage lives in the title, where it is always exact, and the
 * bar uses the theme's own `goal` colour, so it stays visible on a white badge as well as on a dark one.
 */
export function goalBadge(reached: number, goal: number, theme: BadgeTheme = "dark", count: string | null = null): string {
  const t = THEMES[theme];
  if (goal <= 0) return buttonBadge(count, t);
  const h = 44;
  const tile = 24;
  const pad = 6;
  const percent = Math.min(100, Math.floor((reached / goal) * 100));
  const label = run(INTER_TIGHT_600, "Buy me AI tokens", 14, -0.005);
  const chipText = run(INTER_TIGHT_700, `${formatTokens(reached)} / ${formatTokens(goal)}`, 12.5, -0.005);
  const labelX = pad + tile + 10;
  const chipX = labelX + label.width + 12;
  const chipW = chipText.width + 22;
  const width = chipX + chipW + pad;
  const barY = 34;
  const title = esc(`Buy me AI tokens: ${percent}% of goal (${formatTokens(reached)} / ${formatTokens(goal)} tokens)`);
  return wrap(
    width,
    h,
    title,
    shape(width, h, h / 2, t) +
      `<circle cx="${pad + tile / 2}" cy="18" r="${tile / 2}" fill="${t.tile}"/>` +
      icon(LOGO_PATH, pad + tile / 2 - 7, 11, 14, t.tileInk, 1.8) +
      label.svg(labelX, baselineFor(INTER_TIGHT_600, 14, 18), t.fg) +
      `<rect x="${n(chipX)}" y="${pad}" width="${n(chipW)}" height="${tile}" rx="${tile / 2}" fill="${t.chip}"/>` +
      chipText.svg(chipX + 11, baselineFor(INTER_TIGHT_700, 12.5, 18), t.chipInk) +
      `<rect x="${n(chipX)}" y="${barY}" width="${n(chipW)}" height="4" rx="2" fill="${t.fg}" fill-opacity="0.18"/>` +
      (percent > 0
        ? `<rect x="${n(chipX)}" y="${barY}" width="${n((chipW * percent) / 100)}" height="4" rx="2" fill="${t.goal}"/>`
        : ""),
  );
}

/** Button layout with a supporter count in the chip: [ </>  Buy me AI tokens  (12 supporters) ]. */
export function supportersBadge(supporters: number, theme: BadgeTheme = "dark"): string {
  const t = THEMES[theme];
  return buttonBadge(`${supporters} supporter${supporters === 1 ? "" : "s"}`, t);
}
