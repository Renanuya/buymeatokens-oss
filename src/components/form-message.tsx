export type ActionState = { error?: string; message?: string };

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
        {state.message}
      </p>
    );
  }
  return null;
}
