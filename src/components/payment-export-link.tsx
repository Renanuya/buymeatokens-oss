import { legalCopy } from "@/lib/legal/copy";
import { exportPath } from "@/lib/payment-export";

function DownloadIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
    </svg>
  );
}

/** "Download payment history (CSV)" with its note. `detailed` adds what the file does and doesn't cover. */
export function PaymentExportLink({ username, detailed = false, className = "" }: { username: string; detailed?: boolean; className?: string }) {
  const copy = legalCopy();
  return (
    <div className={className}>
      <a href={exportPath(username)} download className="btn-line gap-2 px-4 py-2.5 text-[13px]">
        <DownloadIcon className="size-4" />
        {copy.exportButton}
      </a>
      <p className="mt-2 text-xs leading-relaxed text-muted">{copy.exportNote}</p>
      {detailed && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">{copy.exportCoverage}</p>}
    </div>
  );
}
