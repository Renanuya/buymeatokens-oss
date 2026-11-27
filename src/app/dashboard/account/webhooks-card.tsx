"use client";

import { useActionState, useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-field";
import { SubmitButton } from "@/components/submit-button";
import type { EndpointView } from "@/lib/webhooks";
import { addWebhookAction, deleteWebhookAction, rotateWebhookAction, testWebhookAction, type WebhookResult } from "./webhook-actions";

const DOT = { active: "bg-emerald-500", failing: "bg-amber-500", disabled: "bg-zinc-300" } as const;

function Notice({ result }: { result: WebhookResult }) {
  if (!result.error && !result.message) return null;
  return (
    <div
      role={result.error ? "alert" : "status"}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${result.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
    >
      <p>{result.error ?? result.message}</p>
      {result.secret && (
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-2 font-mono text-xs text-ink">{result.secret}</code>
          <CopyButton value={result.secret} label="Copy secret" />
        </div>
      )}
    </div>
  );
}

/** Webhook endpoints: list, add, test, rotate, delete. A new secret is shown in the answer to the click that made it. */
export function WebhooksCard({ endpoints }: { endpoints: EndpointView[] }) {
  const [added, add] = useActionState<WebhookResult, FormData>(addWebhookAction, {});
  const [other, setOther] = useState<WebhookResult>({});
  const [pending, start] = useTransition();
  const run = (job: () => Promise<WebhookResult>) =>
    start(async () => {
      setOther({});
      setOther(await job());
    });
  const shown = other.error || other.message ? other : added;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
      {endpoints.length > 0 && (
        <ul className="divide-y divide-line">
          {endpoints.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0">
              <span className={`size-2.5 shrink-0 rounded-full ${DOT[e.status]}`} aria-hidden />
              <span className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{e.maskedUrl}</span>
              <span className="text-[13px] text-muted">{e.status === "failing" ? `failing (${e.failStreak})` : e.status}</span>
              <span className="flex gap-2">
                <button type="button" disabled={pending} className="btn-line px-3 py-1.5 text-xs" onClick={() => run(() => testWebhookAction(e.id))}>
                  Send test
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="btn-line px-3 py-1.5 text-xs"
                  onClick={() => window.confirm("Create a new secret? The old one keeps working for 24 hours.") && run(() => rotateWebhookAction(e.id))}
                >
                  Rotate secret
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="btn-line px-3 py-1.5 text-xs"
                  onClick={() => window.confirm("Delete this endpoint? Events waiting for it are dropped.") && run(() => deleteWebhookAction(e.id))}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {endpoints.length < 3 && (
        <form action={add} onSubmit={() => setOther({})} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor="webhook-url" className="label">Endpoint URL</label>
            <input
              id="webhook-url"
              name="url"
              type="url"
              required
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              placeholder="https://example.com/hooks/buymeatokens"
              className="field font-mono"
            />
          </div>
          <SubmitButton pendingText="Checking…">Add endpoint</SubmitButton>
        </form>
      )}
      <Notice result={shown} />
    </div>
  );
}
