import { accessCopy } from "./access-copy";
import { appUrl, devLoginEnabled, DISCORD_URL, SOURCE_URL } from "./config";
import { query, str } from "./db";

// Search and AI-assistant facing facts about buymeatokens. Structured data, llms.txt and the homepage
// all read from here so the product is described the same way everywhere.

export const SITE_NAME = "buymeatokens";

export const SITE_SUMMARY =
  "buymeatokens is a support page for developers and makers: supporters buy them AI token bundles " +
  "(1M, 3M or 5M tokens) to help cover the AI tools behind their work. Payments go directly to the " +
  "creator's own Stripe, PayPal or USDC (Base) wallet, and buymeatokens takes a 0% platform commission.";

/** Plain facts for llms.txt. Access and pricing follow the same switches as the rest of the site. */
export function siteFacts(): string[] {
  const copy = accessCopy();
  return [
    "Creators sign in with GitHub, pick a page name (buymeatokens.com/<name>) and connect Stripe, PayPal or a USDC wallet on Base.",
    "Supporters choose a 1M, 3M or 5M AI-token bundle or a custom amount; each creator sets their own price per 1M tokens (default $5).",
    "Money goes straight to the creator. buymeatokens never holds funds and takes 0% platform commission; payment provider and network fees still apply.",
    "Tokens are a unit of thanks: the creator receives money to spend on their own AI tools. buymeatokens does not sell or issue AI provider credits.",
    "Every page comes with a README badge that shows a live count of the tokens the community has bought.",
    copy.open ? copy.offer : copy.pricing,
    ...(copy.open ? [copy.pricing] : []),
    "buymeatokens is built independently and is in early access.",
  ];
}

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(): JsonLd {
  const base = appUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: SITE_NAME,
    url: base,
    logo: `${base}/icon.svg`,
    description: SITE_SUMMARY,
    sameAs: [SOURCE_URL, DISCORD_URL],
  };
}

export function websiteJsonLd(): JsonLd {
  const base = appUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    url: base,
    inLanguage: "en",
    publisher: { "@id": `${base}/#organization` },
  };
}

export function softwareJsonLd(): JsonLd {
  const base = appUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: base,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description: SITE_SUMMARY,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "0% platform commission on support payments" },
    publisher: { "@id": `${base}/#organization` },
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

export type ProfileInput = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  login: string | null;
  createdAt: number;
};

/** Creator pages: a ProfilePage about one person, linked to their GitHub account. */
export function creatorJsonLd(creator: ProfileInput): JsonLd {
  const base = appUrl();
  const url = `${base}/${creator.username}`;
  const name = creator.displayName || creator.username;
  const plainBio = creator.bio
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    name: `Buy ${name} some AI tokens`,
    ...(creator.createdAt > 0 ? { dateCreated: new Date(creator.createdAt).toISOString() } : {}),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: base },
    mainEntity: {
      "@type": "Person",
      name,
      alternateName: creator.username,
      url,
      ...(plainBio ? { description: plainBio } : {}),
      ...(creator.avatarUrl ? { image: creator.avatarUrl } : {}),
      ...(creator.login ? { sameAs: [`https://github.com/${creator.login}`] } : {}),
    },
  };
}

/** Serializes JSON-LD for a <script> tag; "<" is escaped so user text can never close the tag. */
export function jsonLdScript(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * The rule for "this creator page is public and listable": a claimed name, a real account and a way to get paid.
 * Accounts from the password-less dev login only exist on a local database. They count where that login is on, so the
 * directory and the leaderboard can be tried locally, and are left out everywhere else.
 */
export function indexableSql(): string {
  const realAccount = devLoginEnabled() ? "" : " AND auth_id NOT LIKE 'dev:%'";
  return `username IS NOT NULL${realAccount}
  AND (stripe_key_enc IS NOT NULL OR paypal_email IS NOT NULL OR usdc_address IS NOT NULL)`;
}

/** Public creator pages worth indexing. */
export async function listIndexableCreators(): Promise<{ username: string; createdAt: number }[]> {
  const rs = await query(
    `SELECT username, created_at FROM users
     WHERE ${indexableSql()}
     ORDER BY created_at ASC
     LIMIT 5000`,
  );
  return rs.rows
    .map((r) => ({ username: str(r.username) ?? "", createdAt: Number(r.created_at) || 0 }))
    .filter((r) => r.username);
}
