"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Working…",
  disabled = false,
  className = "btn-dark",
}: {
  children: ReactNode;
  pendingText?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
