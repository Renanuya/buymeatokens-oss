import { INTER_TIGHT_600, INTER_TIGHT_700, type BadgeFont } from "./badge-font";
import { ARROW_PATH, INK, IRIS, LILAC, LILAC_SOFT, LOGO_PATH, WHITE, baselineFor, esc, icon, n, run, wrap, type Run } from "./badge";
import type { WallTheme } from "./badge-options";
import { compactNumber, formatTokens, oneLine } from "./format";

export type { WallTheme };

// The README supporter wall: a card with the creator's recent supporters by name, the totals and a button.
//
//   ┌──────────────────────────────────────────────┐
//   │ (</>)  Supported by 14 people     [ 42M tokens ]│
//   │ (G) Grace Hopper          (L) Linus           │
//   │ (A) Ada                   (M) Margaret        │
//   │ (K) Ken                   (+9) more supporters │
//   │ ───────────────────────────────────────────── │
//   │ [ Buy me AI tokens ↗ ]     buymeatokens.com/maya│
//   └──────────────────────────────────────────────┘
//
// Like the badges, text is drawn as Inter Tight outlines so it looks the same everywhere. A supporter name with a
// character the embedded font doesn't have (CJK, emoji, …) is written as plain SVG text in the viewer's system font,
// and shortened with an estimate of its width instead.

const FUEL = "#aeb8fa";
const W = 480;
const PAD = 20;
const GAP = 16;
const COL_W = (W - 2 * PAD - GAP) / 2;
/** Name cells, the "+N more" cell included. */
const CELLS = 6;
const ROW_H = 40;
const FACE = 28;
const FALLBACK_FONT = "'Inter Tight',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const THEMES = {
  light: {
    bg: WHITE, fg: INK, muted: "#6b6b70", edge: INK, edgeOpacity: 0.12, line: INK, lineOpacity: 0.08,
    tile: LILAC, tileInk: INK, chip: LILAC_SOFT, chipInk: IRIS, faces: [LILAC, FUEL, "#e3e6fd"], faceInk: INK,
    more: LILAC_SOFT, moreInk: IRIS, cta: INK, ctaInk: WHITE,
  },
  dark: {
    bg: INK, fg: WHITE, muted: "#a1a1a6", edge: WHITE, edgeOpacity: 0.14, line: WHITE, lineOpacity: 0.1,
    tile: LILAC, tileInk: INK, chip: LILAC, chipInk: INK, faces: [LILAC, FUEL, "#e3e6fd"], faceInk: INK,
    more: "#34343a", moreInk: WHITE, cta: LILAC, ctaInk: INK,
  },
} as const satisfies Record<WallTheme, unknown>;

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const graphemes = (text: string) => Array.from(segmenter.segment(text), (s) => s.segment);

/** True when every character has an outline in the embedded font. */
function drawable(font: BadgeFont, text: string): boolean {
  return Array.from(text).every((ch) => ch.length === 1 && font.glyphs[ch]);
}

/** Rough width of one character in a system font: wide scripts and emoji take about a full em. */
function approxWidth(g: string, size: number): number {
  const cp = g.codePointAt(0) ?? 0;
  const wide = (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd);
  return size * (wide ? 1.05 : 0.6);
}

/** A line of 600-weight text that fits `maxWidth`, shortened with "…" if needed. */
function fitted(text: string, size: number, maxWidth: number): Run {
  const font = INTER_TIGHT_600;
  if (drawable(font, text)) {
    const whole = run(font, text, size);
    if (whole.width <= maxWidth) return whole;
    const chars = Array.from(text);
    for (let k = chars.length - 1; k > 0; k--) {
      const cut = run(font, `${chars.slice(0, k).join("").trimEnd()}…`, size);
      if (cut.width <= maxWidth) return cut;
    }
    return run(font, "…", size);
  }
  const parts = graphemes(text);
  const total = parts.reduce((sum, g) => sum + approxWidth(g, size), 0);
  let shown = text;
  let width = total;
  if (total > maxWidth) {
    const ellipsis = approxWidth("…", size);
    shown = "";
    width = ellipsis;
    for (const g of parts) {
      const w = approxWidth(g, size);
      if (width + w > maxWidth) break;
      shown += g;
      width += w;
    }
    shown = `${shown.trimEnd()}…`;
  }
  return {
    width,
    svg: (x, baseline, fill) =>
      `<text x="${n(x)}" y="${n(baseline)}" font-family="${FALLBACK_FONT}" font-size="${size}" font-weight="600" fill="${fill}">${esc(shown)}</text>`,
  };
}

/** One centred character (a supporter's initial, or "+9") inside a circle. */
function centered(text: string, size: number, cx: number, cy: number, fill: string): string {
  const font = INTER_TIGHT_600;
  if (drawable(font, text)) {
    const r = run(font, text, size);
    return r.svg(cx - r.width / 2, baselineFor(font, size, cy), fill);
  }
  return `<text x="${n(cx)}" y="${n(baselineFor(font, size, cy))}" text-anchor="middle" font-family="${FALLBACK_FONT}" font-size="${size}" font-weight="600" fill="${fill}">${esc(text)}</text>`;
}

export type WallData = {
  /** Distinct named supporters plus anonymous payments. */
  people: number;
  units: number;
  /** Recent supporter names, newest first. */
  names: string[];
};

/** `page` is the address shown in the footer, e.g. "buymeatokens.com/maya". */
export function renderWall(data: WallData, theme: WallTheme = "light", page = "buymeatokens.com"): string {
  const t = THEMES[theme];
  const names = data.names.map((name) => oneLine(name, 60)).filter(Boolean);
  const people = Math.max(data.people, names.length);
  let shown = names.slice(0, CELLS);
  if (people > shown.length && shown.length === CELLS) shown = shown.slice(0, CELLS - 1);
  const more = people - shown.length;

  const parts: string[] = [];
  const headY = PAD + 16;

  // Header: the logo tile, the headline and the token total.
  parts.push(`<circle cx="${PAD + 16}" cy="${headY}" r="16" fill="${t.tile}"/>`);
  parts.push(icon(LOGO_PATH, PAD + 8, headY - 8, 16, t.tileInk, 1.8));
  const headline = people === 0 ? "Be the first supporter" : `Supported by ${people.toLocaleString("en-US")} ${people === 1 ? "person" : "people"}`;
  const title = run(INTER_TIGHT_700, headline, 15.5, -0.01);
  parts.push(title.svg(PAD + 32 + 12, baselineFor(INTER_TIGHT_700, 15.5, headY), t.fg));
  if (people > 0) {
    const chip = run(INTER_TIGHT_700, `${formatTokens(data.units)} tokens`, 12.5, -0.005);
    const chipW = chip.width + 22;
    const chipX = W - PAD - chipW;
    parts.push(`<rect x="${n(chipX)}" y="${headY - 13}" width="${n(chipW)}" height="26" rx="13" fill="${t.chip}"/>`);
    parts.push(chip.svg(chipX + 11, baselineFor(INTER_TIGHT_700, 12.5, headY), t.chipInk));
  }

  // Body: names in two columns, or one line when there are none to show.
  const bodyY = PAD + 32 + 18;
  let bodyBottom: number;
  if (shown.length > 0) {
    const cells = shown.length + (more > 0 ? 1 : 0);
    shown.forEach((name, i) => {
      const x = PAD + (i % 2) * (COL_W + GAP);
      const cy = bodyY + Math.floor(i / 2) * ROW_H + FACE / 2;
      parts.push(`<circle cx="${n(x + FACE / 2)}" cy="${n(cy)}" r="${FACE / 2}" fill="${t.faces[i % t.faces.length]}"/>`);
      parts.push(centered(graphemes(name)[0].toUpperCase(), 12.5, x + FACE / 2, cy, t.faceInk));
      parts.push(fitted(name, 14, COL_W - FACE - 10).svg(x + FACE + 10, baselineFor(INTER_TIGHT_600, 14, cy), t.fg));
    });
    if (more > 0) {
      const i = shown.length;
      const x = PAD + (i % 2) * (COL_W + GAP);
      const cy = bodyY + Math.floor(i / 2) * ROW_H + FACE / 2;
      parts.push(`<circle cx="${n(x + FACE / 2)}" cy="${n(cy)}" r="${FACE / 2}" fill="${t.more}"/>`);
      parts.push(centered("+", 15, x + FACE / 2, cy, t.moreInk));
      const label = `${compactNumber(more)} more ${more === 1 ? "supporter" : "supporters"}`;
      parts.push(run(INTER_TIGHT_600, label, 14).svg(x + FACE + 10, baselineFor(INTER_TIGHT_600, 14, cy), t.muted));
    }
    bodyBottom = bodyY + (Math.ceil(cells / 2) - 1) * ROW_H + FACE;
  } else {
    const line = people === 0 ? "Fund the AI tokens that build this project." : "Every one of them chose to stay anonymous.";
    parts.push(run(INTER_TIGHT_600, line, 13.5).svg(PAD, baselineFor(INTER_TIGHT_600, 13.5, bodyY + 8), t.muted));
    bodyBottom = bodyY + 16;
  }

  // Footer: a hairline, the button and the page address.
  const lineY = bodyBottom + 18;
  parts.push(`<rect x="${PAD}" y="${n(lineY)}" width="${W - 2 * PAD}" height="1" fill="${t.line}" fill-opacity="${t.lineOpacity}"/>`);
  const ctaY = lineY + 1 + 16;
  const ctaH = 32;
  const label = run(INTER_TIGHT_600, "Buy me AI tokens", 13.5, -0.005);
  const ctaW = 16 + label.width + 8 + 11 + 14;
  parts.push(`<rect x="${PAD}" y="${n(ctaY)}" width="${n(ctaW)}" height="${ctaH}" rx="${ctaH / 2}" fill="${t.cta}"/>`);
  parts.push(label.svg(PAD + 16, baselineFor(INTER_TIGHT_600, 13.5, ctaY + ctaH / 2), t.ctaInk));
  parts.push(icon(ARROW_PATH, PAD + 16 + label.width + 8, ctaY + ctaH / 2 - 5.5, 11, t.ctaInk, 1.9));
  const address = fitted(page, 12.5, W - 2 * PAD - ctaW - 16);
  parts.push(address.svg(W - PAD - address.width, baselineFor(INTER_TIGHT_600, 12.5, ctaY + ctaH / 2), t.muted));

  const h = Math.round(ctaY + ctaH + PAD);
  const card =
    `<rect width="${W}" height="${h}" rx="16" fill="${t.bg}"/>` +
    `<rect x=".5" y=".5" width="${W - 1}" height="${h - 1}" rx="15.5" fill="none" stroke="${t.edge}" stroke-opacity="${t.edgeOpacity}"/>`;
  const summary = people === 0
    ? "Be the first to buy me AI tokens"
    : shown.length === 0
      ? headline
      : `${headline}: ${[...shown, ...(more > 0 ? [`${more} more`] : [])].join(", ")}`;
  return wrap(W, h, esc(summary), card + parts.join(""));
}
