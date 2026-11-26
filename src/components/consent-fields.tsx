"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CONSENT_FIELDS } from "@/lib/consent";
import { legalCopy, templateParts } from "@/lib/legal/copy";

const HREF: Record<string, string> = { terms: "/terms", privacy: "/privacy" };
const LABEL: Record<string, "termsOfService" | "privacyPolicy"> = { terms: "termsOfService", privacy: "privacyPolicy" };

function Box({ name, checked, onChange, autoFocus, children }: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  autoFocus?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed transition ${
        checked ? "border-iris/50 bg-lilac-soft text-ink" : "border-line bg-white text-ink/80 hover:border-ink/25"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        required
        checked={checked}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-iris"
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

/**
 * The two boxes a creator ticks before their page is created, and again after the Terms change.
 * Both start unticked. The Terms and Privacy links open in a new tab so the form keeps its state.
 */
export function ConsentFields({ onChange, autoFocus = false }: { onChange?: (bothTicked: boolean) => void; autoFocus?: boolean }) {
  const copy = legalCopy();
  const [terms, setTerms] = useState(false);
  const [age, setAge] = useState(false);
  useEffect(() => onChange?.(terms && age), [terms, age, onChange]);

  return (
    <fieldset className="space-y-2.5">
      <legend className="sr-only">Terms and age confirmation</legend>
      <Box name={CONSENT_FIELDS.terms} checked={terms} onChange={setTerms} autoFocus={autoFocus}>
        {templateParts(copy.consentTerms).map((part, i) =>
          "text" in part ? (
            part.text
          ) : (
            <a
              key={i}
              href={HREF[part.link]}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink underline underline-offset-2 hover:text-iris"
            >
              {copy.links[LABEL[part.link]]}
            </a>
          ),
        )}
      </Box>
      <Box name={CONSENT_FIELDS.age} checked={age} onChange={setAge}>
        {copy.consentAge}
      </Box>
    </fieldset>
  );
}
