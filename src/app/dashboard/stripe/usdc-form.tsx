"use client";

import { useActionState } from "react";
import { FormMessage, type ActionState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { saveUsdcAddressAction } from "../actions";

export function UsdcAddressForm({ current }: { current: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveUsdcAddressAction, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="address" className="label">
          {current ? "Change wallet address" : "Your wallet address on Base"}
        </label>
        <input
          id="address"
          name="address"
          required
          autoComplete="off"
          spellCheck={false}
          defaultValue={current ?? ""}
          placeholder="0x…"
          className="field font-mono"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">{current ? "Update address" : "Save & go live"}</SubmitButton>
    </form>
  );
}
