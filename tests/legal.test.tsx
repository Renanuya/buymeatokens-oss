import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { LegalMarkdown } from "../src/components/legal-document";
import { LegalFooter } from "../src/components/legal-footer";
import { CreatorPaymentNotice, SupporterPaymentNotice, UsdcNetworkWarning } from "../src/components/payment-notices";
import { SiteFooter } from "../src/components/site-footer";
import TaxesFaqPage from "../src/app/faq/taxes/page";
import { LEGAL, TERMS_VERSION, legalValue, type LegalConfig } from "../src/lib/legal/config";
import { legalCopy, templateText } from "../src/lib/legal/copy";
import { fillPlaceholders, getLegalDocument, unfilledPlaceholders } from "../src/lib/legal/documents";

const ROOT = join(__dirname, "..");
const PLACEHOLDERS = [
  "LEGAL_LAST_UPDATED",
  "PRIVACY_LAST_UPDATED",
  "CONTACT_EMAIL",
  "GOVERNING_LAW_TEXT",
  "LOG_RETENTION_DAYS",
  "ACCOUNT_DELETE_DAYS",
  "HOSTING_PROVIDERS_TEXT",
  "AI_PROVIDERS_TEXT",
];

// The notices must stay word for word as the legal brief wrote them.
const BRIEF = {
  footer:
    "buymeatokens does not hold, process or pay out supporter money. Payments go directly from the supporter to the creator through the creator's own PayPal, Stripe or USDC account. Creators are responsible for any taxes, declarations or invoices that apply to what they receive under the law where they live. We do not give tax or legal advice.",
  creator: "You receive support directly in your own account. You are responsible for reporting and paying any taxes on it.",
  supporter:
    "You are sending support directly to this creator. buymeatokens does not receive or hold your payment. Payments are generally non-refundable, and USDC transfers cannot be reversed.",
  usdc: "Send USDC on the Base network only. Sending on another network can lose your funds permanently. Check the address before you send.",
  consentTerms:
    "I have read the Terms of Service and Privacy Policy. I understand that I am responsible for reporting and paying any taxes on the support I receive, and that buymeatokens does not withhold, collect or report tax on my behalf.",
  consentAge: "I am at least 18 years old.",
};

const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");

function files(dir: string, match: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, match) : match(path) ? [path] : [];
  });
}

describe("legal config", () => {
  it("lists every placeholder in one config file, with the owner's values filled in", () => {
    expect(Object.keys(LEGAL).sort()).toEqual([...PLACEHOLDERS].sort());
    for (const name of PLACEHOLDERS) expect(LEGAL[name as keyof LegalConfig]).not.toBeNull();
    expect(LEGAL.CONTACT_EMAIL).toBe("privacy@buymeatokens.com");
    expect(TERMS_VERSION).toBe("2026-11-25");
  });

  it("shows unset values as their visible placeholder", () => {
    expect(legalValue("CONTACT_EMAIL", { ...LEGAL, CONTACT_EMAIL: null })).toBe("[CONTACT_EMAIL]");
    expect(legalValue("LOG_RETENTION_DAYS")).toBe("90");
  });
});

describe("/terms and /privacy", () => {
  it("publish the Terms with every numbered section and the configured values", () => {
    const doc = getLegalDocument("terms");
    expect(doc.title).toBe("Terms of Service");
    for (const heading of [
      "## 1. What buymeatokens is",
      "## 2. Accounts",
      "## 3. How payments work",
      "## 4. Support is voluntary",
      "## 5. Taxes",
      "## 6. Fees",
      "## 7. Acceptable use",
      "## 8. Content and links",
      "## 9. Disclaimer and limit of liability",
      "## 10. Changes and contact",
    ]) {
      expect(doc.markdown).toContain(heading);
    }
    expect(unfilledPlaceholders(doc.markdown)).toEqual([]);
    expect(doc.markdown).toContain("buymeatokens.com is operated by Ali Renan Uyanık, an individual based in Turkey");
    expect(doc.markdown).toContain("Last updated: November 25, 2026.");
    expect(doc.markdown).toContain(
      "Governing law and courts: the laws of the Republic of Türkiye; the courts and enforcement offices of Istanbul have jurisdiction. If you are a consumer, this does not take away the protection that the mandatory laws of your country of residence give you. Contact: privacy@buymeatokens.com.",
    );
    // A value taken out of the config shows as its placeholder again instead of disappearing.
    const unset = Object.fromEntries(PLACEHOLDERS.map((name) => [name, null])) as unknown as LegalConfig;
    expect(unfilledPlaceholders(getLegalDocument("terms", "en", unset).markdown)).toEqual([
      "LEGAL_LAST_UPDATED",
      "GOVERNING_LAW_TEXT",
      "CONTACT_EMAIL",
    ]);
  });

  it("publish the Privacy Policy with its table and the configured values", () => {
    const doc = getLegalDocument("privacy");
    expect(doc.title).toBe("Privacy Policy");
    for (let i = 1; i <= 9; i++) expect(doc.markdown).toMatch(new RegExp(`^## ${i}\\. `, "m"));
    expect(unfilledPlaceholders(doc.markdown)).toEqual([]);
    expect(doc.markdown).toContain("then remove it within 30 days");
    expect(doc.markdown).toContain("Technical logs are kept for 90 days.");
    expect(doc.markdown).toContain("Last updated: November 27, 2026.");
    expect(doc.markdown).toContain(
      "Hosting, database and email providers process data for us under their own terms: Vercel (hosting), Supabase (database) and Mailjet (email delivery).",
    );
    expect(doc.markdown).toContain("are sent to Groq to draft their project description. No account data is sent with it.");
    expect(doc.markdown).toContain("send you account emails: a welcome, at most one setup reminder, and an email when someone supports you");
    expect(doc.markdown).toContain("- We do not use third-party analytics or advertising tools.");
    expect(doc.markdown).toContain("No cookies are used and no IP address is stored");
    expect(doc.markdown).not.toContain("analytics providers");
    const html = renderToStaticMarkup(<LegalMarkdown>{doc.markdown}</LegalMarkdown>);
    expect(html).toContain("<h1");
    expect(html).toContain("<table>");
    expect(html).toContain('href="mailto:privacy@buymeatokens.com"');
    expect(html).not.toMatch(/\[[A-Z_]+\]/);
    const unset = Object.fromEntries(PLACEHOLDERS.map((name) => [name, null])) as unknown as LegalConfig;
    expect(unfilledPlaceholders(getLegalDocument("privacy", "en", unset).markdown).sort()).toEqual(
      ["ACCOUNT_DELETE_DAYS", "AI_PROVIDERS_TEXT", "CONTACT_EMAIL", "HOSTING_PROVIDERS_TEXT", "LOG_RETENTION_DAYS", "PRIVACY_LAST_UPDATED"].sort(),
    );
  });

  it("fill a placeholder only from the config, leaving the others visible", () => {
    const filled = fillPlaceholders("Contact: [CONTACT_EMAIL]. Logs: [LOG_RETENTION_DAYS] days. [UNKNOWN]", {
      ...LEGAL,
      CONTACT_EMAIL: "legal@example.com",
      LOG_RETENTION_DAYS: null,
    });
    expect(filled).toBe("Contact: legal@example.com. Logs: [LOG_RETENTION_DAYS] days. [UNKNOWN]");
  });

  it("render the Taxes FAQ with its five questions and a link to the dashboard", () => {
    const html = renderToStaticMarkup(<TaxesFaqPage />);
    for (const q of [
      "Who pays tax on support?",
      "Do I have to declare it?",
      "Do I need to open a company?",
      "Can I get my records?",
      "What should I do?",
    ]) {
      expect(html).toContain(q);
    }
    expect(text(html)).toContain(
      "Yes. Download your payment history as a CSV from your dashboard and keep it for your own accounting.",
    );
    expect(html).toContain('href="/dashboard/account"');
    const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
    expect(article).not.toMatch(/https?:\/\/(?!buymeatokens)/); // no third-party tax guides (the site footer may link out)
  });
});

describe("notices", () => {
  it("keep the exact wording", () => {
    const copy = legalCopy();
    expect(copy.footerNotice).toBe(BRIEF.footer);
    expect(copy.creatorPaymentNotice).toBe(BRIEF.creator);
    expect(copy.supporterPaymentNotice).toBe(BRIEF.supporter);
    expect(copy.usdcNetworkWarning).toBe(BRIEF.usdc);
    expect(templateText(copy.consentTerms, { terms: "Terms of Service", privacy: "Privacy Policy" })).toBe(BRIEF.consentTerms);
    expect(copy.consentAge).toBe(BRIEF.consentAge);
  });

  it("render as visible text, not tooltips", () => {
    for (const [node, expected] of [
      [<CreatorPaymentNotice key="c" />, BRIEF.creator],
      [<SupporterPaymentNotice key="s" />, BRIEF.supporter],
      [<UsdcNetworkWarning key="u" />, BRIEF.usdc],
    ] as const) {
      const html = renderToStaticMarkup(node);
      expect(text(html)).toContain(expected);
      expect(html).not.toContain("title=");
    }
    expect(renderToStaticMarkup(<CreatorPaymentNotice />)).toContain('href="/faq/taxes"');
  });
});

describe("footer", () => {
  it("carries Terms, Privacy, Taxes and the notice in both footer designs", () => {
    for (const html of [renderToStaticMarkup(<LegalFooter />), renderToStaticMarkup(<SiteFooter />)]) {
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/faq/taxes"');
      expect(text(html)).toContain(BRIEF.footer);
    }
  });

  it("is on every page: each page or one of its layouts renders a footer", () => {
    const app = join(ROOT, "src", "app");
    // The stream alerts widget is a transparent OBS browser source: no site chrome on purpose.
    const pages = files(app, (p) => (/[/\\]page\.tsx$/.test(p) || /[/\\]not-found\.tsx$/.test(p)) && !/[/\\]alerts[/\\]/.test(p));
    const hasFooter = (source: string) => /<(SiteFooter|LegalFooter|LegalPage)\b/.test(source);
    const missing = pages.filter((page) => {
      if (hasFooter(readFileSync(page, "utf8"))) return false;
      for (let dir = dirname(page); dir.startsWith(app); dir = dirname(dir)) {
        try {
          if (hasFooter(readFileSync(join(dir, "layout.tsx"), "utf8"))) return false;
        } catch {
          // no layout at this level
        }
      }
      return true;
    });
    expect(missing.map((p) => relative(ROOT, p))).toEqual([]);
    expect(pages.length).toBeGreaterThan(15);
  });
});

describe("wording rules", () => {
  // Every text a visitor can read: components, pages, emails, the legal texts and the blog.
  const userFacing = [
    ...files(join(ROOT, "src"), (p) => /\.(tsx?|md)$/.test(p)),
    ...files(join(ROOT, "content"), (p) => p.endsWith(".md")),
  ];

  it("never claims to handle taxes or invoices for anyone", () => {
    const banned = [
      /we handle your taxes/i,
      /tax[- ]free/i,
      /we report to the tax office for you/i,
      /we issue invoices for you/i,
      /your income is not taxable/i,
    ];
    const hits = userFacing.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return banned.filter((re) => re.test(source)).map((re) => `${relative(ROOT, file)}: ${re}`);
    });
    expect(hits).toEqual([]);
  });

  it("doesn't ask Stripe to show a Donate button", () => {
    expect(readFileSync(join(ROOT, "src", "lib", "stripe.ts"), "utf8")).not.toMatch(/submit_type:\s*"donate"/);
  });
});
