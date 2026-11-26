import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LEGAL, type LegalConfig, type LegalPlaceholder, legalValue } from "./config";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./copy";

// The Terms of Service and Privacy Policy are Markdown files in content/legal/<language>/, published as written.
// Placeholders such as [CONTACT_EMAIL] are filled from src/lib/legal/config.ts; unset ones stay visible.
// A translation is a new folder (content/legal/tr/) plus "tr" in LOCALES; English is the fallback.

export const LEGAL_DIR = join(process.cwd(), "content", "legal");

export const LEGAL_DOCUMENTS = ["terms", "privacy"] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENTS)[number];

const PLACEHOLDER_RE = /\[([A-Z][A-Z0-9_]+)\]/g;

function isPlaceholder(name: string, config: LegalConfig): name is LegalPlaceholder {
  return Object.prototype.hasOwnProperty.call(config, name);
}

/** Replaces each known [PLACEHOLDER] that has a value; unknown or unset ones are left exactly as they are. */
export function fillPlaceholders(markdown: string, config: LegalConfig = LEGAL): string {
  return markdown.replace(PLACEHOLDER_RE, (match, name: string) => (isPlaceholder(name, config) ? legalValue(name, config) : match));
}

/** Placeholders still visible in a text, in order of appearance, without repeats. */
export function unfilledPlaceholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]))];
}

export function availableLocales(kind: LegalDocumentKind): Locale[] {
  return LOCALES.filter((locale) => existsSync(join(LEGAL_DIR, locale, `${kind}.md`)));
}

export type LegalDocument = { kind: LegalDocumentKind; locale: Locale; title: string; markdown: string };

export function getLegalDocument(kind: LegalDocumentKind, locale: Locale = DEFAULT_LOCALE, config: LegalConfig = LEGAL): LegalDocument {
  const file = join(LEGAL_DIR, locale, `${kind}.md`);
  const source = readFileSync(existsSync(file) ? file : join(LEGAL_DIR, DEFAULT_LOCALE, `${kind}.md`), "utf8");
  const markdown = fillPlaceholders(source, config);
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? kind;
  return { kind, locale: existsSync(file) ? locale : DEFAULT_LOCALE, title, markdown };
}
