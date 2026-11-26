"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { sendCreatorEmailTestAction } from "../actions";
import type { CreatorEmailKind } from "@/lib/creator-emails";

export function WelcomeSendForm({ userId, disabled, testTo, kind }: { userId: string; disabled: boolean; testTo: string; kind: CreatorEmailKind }) {
  const [state, action] = useActionState(sendCreatorEmailTestAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton disabled={disabled} pendingText="Sending…" className="btn-dark w-full break-all px-5 py-3 text-sm">
        Send test to {testTo}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
