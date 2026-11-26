// The one place for the legal values that only the operator of the site can decide. Nothing here is invented.
//
// A value left as null is shown on /terms and /privacy as its visible placeholder, for example
// "[CONTACT_EMAIL]". Fill a value in here and every page that uses it changes with it.
// The texts themselves live in content/legal/<language>/*.md.

export type LegalConfig = {
  /** The "Last updated" date on /terms, written as it should appear, e.g. "25 November 2026". */
  LEGAL_LAST_UPDATED: string | null;
  /** The "Last updated" date on /privacy. It moves on its own when only the Privacy Policy changes. */
  PRIVACY_LAST_UPDATED: string | null;
  /** Address for legal and privacy questions and for account deletion requests. */
  CONTACT_EMAIL: string | null;
  /** Governing law and courts, as confirmed with a lawyer. */
  GOVERNING_LAW_TEXT: string | null;
  /** Days technical logs are kept, e.g. 90. */
  LOG_RETENTION_DAYS: number | null;
  /** Days within which a deleted account is fully removed, e.g. 30. */
  ACCOUNT_DELETE_DAYS: number | null;
  /** Hosting, database and email providers named in the Privacy Policy. */
  HOSTING_PROVIDERS_TEXT: string | null;
  /** Who drafts project descriptions for "Write with AI" (src/lib/ai-draft.ts), named in the Privacy Policy. */
  AI_PROVIDERS_TEXT: string | null;
};

// The values for buymeatokens.com, chosen by its operator on 2026-11-25. If you run your own copy, these are yours
// to change: your contact address, your law and your providers.
export const LEGAL: LegalConfig = {
  LEGAL_LAST_UPDATED: "November 25, 2026",
  PRIVACY_LAST_UPDATED: "November 26, 2026",
  CONTACT_EMAIL: "privacy@buymeatokens.com",
  GOVERNING_LAW_TEXT:
    "the laws of the Republic of Türkiye; the courts and enforcement offices of Istanbul have jurisdiction. If you are a consumer, this does not take away the protection that the mandatory laws of your country of residence give you",
  LOG_RETENTION_DAYS: 90,
  ACCOUNT_DELETE_DAYS: 30,
  HOSTING_PROVIDERS_TEXT: "Vercel (hosting), Supabase (database) and Mailjet (email delivery)",
  // Gemini is tried first only when GEMINI_API_KEY is set, which it isn't in production. Name Google here if it is.
  AI_PROVIDERS_TEXT: "Groq",
};

export type LegalPlaceholder = keyof LegalConfig;

/**
 * The Terms and Privacy Policy version creators accept. Change it whenever creators must accept again:
 * everyone whose stored version differs sees the acceptance dialog on their next visit to the dashboard.
 */
export const TERMS_VERSION = "2026-11-25";

/**
 * Deadline used for deletion records while ACCOUNT_DELETE_DAYS is still a placeholder. Accounts are removed
 * at once when deletion is confirmed, so this is an upper bound, not a waiting period.
 */
export const DEFAULT_ACCOUNT_DELETE_DAYS = 30;

export function accountDeleteDays(): number {
  return LEGAL.ACCOUNT_DELETE_DAYS ?? DEFAULT_ACCOUNT_DELETE_DAYS;
}

/** A configured value as text, or its visible placeholder, e.g. "[CONTACT_EMAIL]". */
export function legalValue(name: LegalPlaceholder, config: LegalConfig = LEGAL): string {
  const value = config[name];
  return value === null || value === "" ? `[${name}]` : String(value);
}

/** The contact address, or null while it is still a placeholder. */
export function contactEmail(config: LegalConfig = LEGAL): string | null {
  return config.CONTACT_EMAIL || null;
}
