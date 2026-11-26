"use client";

import { useActionState, useState } from "react";
import { FormMessage, type ActionState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { deleteAccountAction } from "./actions";
import { matchesConfirmation } from "./confirm";

export function DeleteAccountForm({ confirmName }: { confirmName: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteAccountAction, {});
  const [typed, setTyped] = useState("");
  const ready = matchesConfirmation(typed, confirmName);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="confirm-delete" className="label">
          Type your GitHub username <span className="font-mono font-semibold">{confirmName}</span> to confirm
        </label>
        <input
          id="confirm-delete"
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={confirmName}
          className="field font-mono"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton
        disabled={!ready}
        pendingText="Deleting…"
        className="inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete my account
      </SubmitButton>
    </form>
  );
}
