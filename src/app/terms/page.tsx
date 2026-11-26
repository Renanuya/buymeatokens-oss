import type { Metadata } from "next";
import { LegalMarkdown, LegalPage } from "@/components/legal-document";
import { getLegalDocument } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using buymeatokens.com: direct payments to creators, voluntary support, taxes and acceptable use.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  const doc = getLegalDocument("terms");
  return (
    <LegalPage current="/terms">
      <LegalMarkdown>{doc.markdown}</LegalMarkdown>
    </LegalPage>
  );
}
