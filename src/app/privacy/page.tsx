import type { Metadata } from "next";
import { LegalMarkdown, LegalPage } from "@/components/legal-document";
import { getLegalDocument } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What buymeatokens.com collects, why, who else receives it, how long it is kept and how to delete your account.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const doc = getLegalDocument("privacy");
  return (
    <LegalPage current="/privacy">
      <LegalMarkdown>{doc.markdown}</LegalMarkdown>
    </LegalPage>
  );
}
