"use client";

import { useActionState } from "react";
import { FormMessage, type ActionState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { connectDiscordAction, disconnectDiscordAction } from "./actions";

/** Paste, replace or disconnect the Discord webhook. The saved URL never comes back here; only its last four characters. */
export function DiscordWebhookForm({ hint, stopped }: { hint: string | null; stopped: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(connectDiscordAction, {});
  return (
    <div className="space-y-3">
      {stopped && !hint && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
          The webhook stopped working. Discord says it no longer exists, so we disconnected it. Paste a new one to start again.
        </p>
      )}
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="webhook"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          aria-label="Discord webhook URL"
          placeholder={hint ? `Replace it: https://discord.com/api/webhooks/…` : "https://discord.com/api/webhooks/…"}
          className="field min-w-0 flex-1 font-mono"
        />
        <SubmitButton pendingText="Checking…">{hint ? "Replace" : "Connect"}</SubmitButton>
      </form>
      <FormMessage state={state} />
      {hint && (
        <form action={disconnectDiscordAction} className="flex items-center gap-3">
          <span className="text-[13px]">Connected, webhook ending in <span className="font-mono text-ink">{hint}</span>.</span>
          <SubmitButton pendingText="Removing…" className="text-[13px] font-semibold text-ink underline underline-offset-2">
            Disconnect
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
