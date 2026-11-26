import Link from "next/link";
import { legalCopy } from "@/lib/legal/copy";
import { Glyph } from "./glyph";

// The notices on payment screens. The words live in src/lib/legal/copy.ts; these only place them.
// No hooks, so they render on the server and inside client components alike.

/** Above the payment-method forms (Payments page and the setup step), with the Taxes FAQ link. */
export function CreatorPaymentNotice({ className = "" }: { className?: string }) {
  const copy = legalCopy();
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5 text-sm leading-relaxed ${className}`}>
      <Glyph name="info" className="mt-0.5 size-4 shrink-0 text-iris" />
      <p className="min-w-0 text-ink/80">
        {copy.creatorPaymentNotice}{" "}
        <Link href="/faq/taxes" className="whitespace-nowrap font-semibold text-ink underline underline-offset-2 hover:text-iris">
          {copy.taxesFaqLink}
        </Link>
      </p>
    </div>
  );
}

/** Next to the pay button on a creator's page. */
export function SupporterPaymentNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-balance text-center text-[12px] leading-relaxed text-muted ${className}`}>
      {legalCopy().supporterPaymentNotice}
    </p>
  );
}

/** Next to a USDC address: Base only. */
export function UsdcNetworkWarning({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950 ${className}`}
    >
      <Glyph name="info" className="mt-px size-3.5 shrink-0 text-amber-700" />
      <span>{legalCopy().usdcNetworkWarning}</span>
    </p>
  );
}
