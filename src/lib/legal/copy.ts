// Every legal and payment notice the site shows, in one place, keyed by language so a Turkish version can be
// added later without touching the components. The English texts below come from the legal brief and must stay
// word for word; do not translate the legal texts automatically.
//
// {name} marks a link that the component fills in, e.g. {terms} becomes a "Terms of Service" link.

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type FaqEntry = { q: string; a: string };

export type LegalCopy = {
  links: { terms: string; privacy: string; taxes: string; termsOfService: string; privacyPolicy: string; dashboard: string };
  /** Small text in the footer of every page. */
  footerNotice: string;
  /** Above the payment-method forms, for creators. */
  creatorPaymentNotice: string;
  taxesFaqLink: string;
  /** Next to the pay button, for supporters. */
  supporterPaymentNotice: string;
  /** Next to the USDC address. */
  usdcNetworkWarning: string;
  usdcNetworkLabel: string;
  usdcAddressLabel: string;
  /** The two checkboxes a creator ticks before their page is created, and again after a terms change. */
  consentTerms: string;
  consentAge: string;
  consentRequired: string;
  consentDialog: { eyebrow: string; title: string; body: string; submit: string; pending: string; logout: string; delete: string };
  exportButton: string;
  exportNote: string;
  exportCoverage: string;
  taxesFaq: { title: string; entries: FaqEntry[] };
};

const en: LegalCopy = {
  links: {
    terms: "Terms",
    privacy: "Privacy",
    taxes: "Taxes",
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy",
    dashboard: "your dashboard",
  },
  footerNotice:
    "buymeatokens does not hold, process or pay out supporter money. Payments go directly from the supporter to the creator through the creator's own PayPal, Stripe or USDC account. Creators are responsible for any taxes, declarations or invoices that apply to what they receive under the law where they live. We do not give tax or legal advice.",
  creatorPaymentNotice:
    "You receive support directly in your own account. You are responsible for reporting and paying any taxes on it.",
  taxesFaqLink: "Taxes FAQ",
  supporterPaymentNotice:
    "You are sending support directly to this creator. buymeatokens does not receive or hold your payment. Payments are generally non-refundable, and USDC transfers cannot be reversed.",
  usdcNetworkWarning:
    "Send USDC on the Base network only. Sending on another network can lose your funds permanently. Check the address before you send.",
  usdcNetworkLabel: "Network",
  usdcAddressLabel: "Address",
  consentTerms:
    "I have read the {terms} and {privacy}. I understand that I am responsible for reporting and paying any taxes on the support I receive, and that buymeatokens does not withhold, collect or report tax on my behalf.",
  consentAge: "I am at least 18 years old.",
  consentRequired: "Please tick both boxes to continue.",
  consentDialog: {
    eyebrow: "Terms",
    title: "Please review our terms.",
    body: "We published a Terms of Service and a Privacy Policy. Please confirm both points below to keep editing your page. Your public page stays online in the meantime.",
    submit: "Accept and continue",
    pending: "Saving…",
    logout: "Log out",
    delete: "Delete my account instead",
  },
  exportButton: "Download payment history (CSV)",
  exportNote: "Keep this file for your own tax records.",
  exportCoverage:
    "It lists live payments recorded on buymeatokens: Stripe and PayPal payments confirmed through your page, and USDC transfers confirmed on your page. USDC sent to your wallet without that confirmation, test-mode payments and payments made outside buymeatokens are not included. Amounts are what the supporter sent, before provider or network fees.",
  taxesFaq: {
    title: "Taxes",
    entries: [
      {
        q: "Who pays tax on support?",
        a: "The creator who receives it, under the law where they live. buymeatokens does not collect, withhold or report tax for you.",
      },
      {
        q: "Do I have to declare it?",
        a: "It depends on your country and on how regular the amounts are. In many countries support you receive for a project counts as income, even when it is not called income on the platform. Some countries have small-amount exceptions. We cannot tell you which rules apply to you.",
      },
      {
        q: "Do I need to open a company?",
        a: "Not because of buymeatokens. Whether you need a business registration depends on your country and on how regular and how large your income is.",
      },
      {
        q: "Can I get my records?",
        a: "Yes. Download your payment history as a CSV from {dashboard} and keep it for your own accounting.",
      },
      {
        q: "What should I do?",
        a: "Ask a local accountant or tax adviser. If you are unsure, ask before the amounts become regular.",
      },
    ],
  },
};

const COPY: Record<Locale, LegalCopy> = { en };

export function legalCopy(locale: Locale = DEFAULT_LOCALE): LegalCopy {
  return COPY[locale] ?? COPY[DEFAULT_LOCALE];
}

export const LEGAL_LINKS = [
  { href: "/terms", key: "terms" },
  { href: "/privacy", key: "privacy" },
  { href: "/faq/taxes", key: "taxes" },
] as const;

export type TemplatePart = { text: string } | { link: string };

/** Splits "Read the {terms} first" into text and link parts, so components can render the links. */
export function templateParts(template: string): TemplatePart[] {
  return template
    .split(/(\{[a-z]+\})/g)
    .filter(Boolean)
    .map((part) => (/^\{[a-z]+\}$/.test(part) ? { link: part.slice(1, -1) } : { text: part }));
}

/** The template as plain text, with each {name} replaced by its label. */
export function templateText(template: string, labels: Record<string, string>): string {
  return templateParts(template)
    .map((part) => ("text" in part ? part.text : (labels[part.link] ?? part.link)))
    .join("");
}
