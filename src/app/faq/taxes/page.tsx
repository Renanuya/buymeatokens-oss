import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-document";
import { legalCopy, templateParts } from "@/lib/legal/copy";

export const metadata: Metadata = {
  title: "Taxes FAQ",
  description: "Who pays tax on support received through buymeatokens, and where creators can download their payment history.",
  alternates: { canonical: "/faq/taxes" },
};

// The payment history download lives on the Account tab of the dashboard.
const LINKS: Record<string, string> = { dashboard: "/dashboard/account" };

export default function TaxesFaqPage() {
  const copy = legalCopy();
  const faq = copy.taxesFaq;
  return (
    <LegalPage current="/faq/taxes" showVersion={false}>
      <div className="legal-prose">
        <h1 className="display text-[clamp(2.4rem,6vw,4.25rem)]">{faq.title}</h1>
        {faq.entries.map((entry) => (
          <section key={entry.q}>
            <h2>{entry.q}</h2>
            <p>
              {templateParts(entry.a).map((part, i) =>
                "text" in part ? (
                  part.text
                ) : (
                  <Link key={i} href={LINKS[part.link] ?? "/"}>
                    {copy.links[part.link as keyof typeof copy.links] ?? part.link}
                  </Link>
                ),
              )}
            </p>
          </section>
        ))}
      </div>
    </LegalPage>
  );
}
