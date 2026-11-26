"use client";

import { useActionState } from "react";
import { FormMessage, type ActionState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { savePaypalEmailAction } from "../actions";

export function PaypalEmailForm({ current }: { current: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(savePaypalEmailAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="paypal-email" className="label">
          {current ? "Change PayPal email" : "Your PayPal email"}
        </label>
        <input
          id="paypal-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={current ?? ""}
          placeholder="you@example.com"
          className="field"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">{current ? "Update email" : "Save & go live"}</SubmitButton>
    </form>
  );
}
