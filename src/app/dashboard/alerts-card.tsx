"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-field";
import { disableAlertsAction, enableAlertsAction } from "./actions";

/**
 * Stream alerts: a private URL for an OBS or Streamlabs browser source. Only a hash of it is stored, so the URL is
 * shown once, right after it is made.
 */
export function AlertsCard({ enabled }: { enabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const make = () => start(async () => setUrl((await enableAlertsAction()).url));
  const turnOff = () =>
    start(async () => {
      await disableAlertsAction();
      setUrl(null);
    });

  return (
    <div className="mt-2 space-y-4">
      <p className="text-sm text-muted">
        Show new support on your stream. Add the URL as a browser source in OBS or Streamlabs. Anyone with it can see your
        incoming support, so keep it private.
      </p>
      {enabled && url && (
        <div>
          <div className="flex h-12 min-w-0 items-center gap-2.5 rounded-xl border border-line bg-paper pl-3.5 pr-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
            <CopyButton value={url} label="Copy URL" className="size-9 rounded-lg text-ink/60 hover:bg-white hover:text-ink" />
          </div>
          <p className="mt-2 text-xs text-muted">Copy it now: it can&apos;t be shown again.</p>
        </div>
      )}
      {enabled && !url && (
        <p className="text-sm">Alerts are on. The URL can&apos;t be shown again, so regenerate it if you lost it.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {enabled ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm("The current URL will stop working. Continue?") && make()}
              className="btn-line"
            >
              Regenerate
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm("Alerts will stop on your stream. Continue?") && turnOff()}
              className="btn-line"
            >
              Disable
            </button>
            <a href="/alerts/preview?test=1&amount=1" target="_blank" rel="noopener noreferrer" className="btn-line">
              Preview a test alert
            </a>
          </>
        ) : (
          <button type="button" disabled={pending} onClick={make} className="btn-dark">
            Turn on
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Options, added to the URL: <code>duration=10</code> seconds, <code>sound=1</code>, <code>amount=1</code>,{" "}
        <code>message=0</code>, <code>theme=light</code>.
      </p>
    </div>
  );
}
