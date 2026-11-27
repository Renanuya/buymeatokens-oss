// Secrets never go into logs, error messages or anything sent to a browser. Payment code logs through logError,
// which blanks out anything shaped like a credential, in case a provider ever echoes one back.

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+/g, // Stripe API keys (secret, restricted, publishable)
  /\bwhsec_[A-Za-z0-9]+/g, // webhook signing secrets
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g, // GitHub tokens
  /\bbmta_[A-Za-z0-9_-]{20,}/g, // stream alert URLs
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/g, // Authorization headers
];

/** Common key prefixes that must never appear in log output. Used by the tests as well. */
export const SECRET_PREFIX_RE = /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{6,}|\bwhsec_[A-Za-z0-9]{6,}|\bgh[pousr]_[A-Za-z0-9]{20,}/;

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((out, pattern) => out.replace(pattern, "[redacted]"), text);
}

/** An error or value as one redacted line: "Name: message". Stacks are left out on purpose. */
export function describeForLog(value: unknown): string {
  if (value instanceof Error) return redactSecrets(`${value.name}: ${value.message}`);
  if (typeof value === "string") return redactSecrets(value);
  try {
    return redactSecrets(JSON.stringify(value) ?? String(value));
  } catch {
    return redactSecrets(String(value));
  }
}

/** console.error with every detail redacted. */
export function logError(tag: string, ...details: unknown[]): void {
  console.error(tag, ...details.map(describeForLog));
}
