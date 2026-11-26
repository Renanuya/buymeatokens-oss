"use client";

import { useActionState } from "react";
import { FormMessage, type ActionState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { saveStripeKeyAction } from "../actions";

export function StripeKeyForm({ connected }: { connected: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(saveStripeKeyAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="key" className="label">
          {connected ? "Replace restricted key" : "Restricted key"}
        </label>
        <input
          id="key"
          name="key"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="rk_test_… or rk_live_…"
          className="field font-mono"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Checking with Stripe…">Verify &amp; save</SubmitButton>
    </form>
  );
}
