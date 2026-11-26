export function formatUsd(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** One unit = 1M tokens. */
export function formatTokens(units: number): string {
  if (units >= 1000) {
    const billions = units / 1000;
    return `${Number.isInteger(billions) ? billions : billions.toFixed(1)}B`;
  }
  return `${units}M`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.max(1, Math.round((now - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ms);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // By code point: cutting an emoji in half leaves a broken character, and React then fails to hydrate.
  const letters =
    parts.length > 1 ? [Array.from(parts[0])[0], Array.from(parts[1])[0]] : Array.from(parts[0] ?? "?").slice(0, 2);
  return letters.join("").toUpperCase();
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "Ada Lovelace" -> "Ada", but "The Octocat" stays whole (no "Buy The some AI tokens"). */
export function shortName(displayName: string): string {
  const name = displayName.trim();
  const first = name.split(/\s+/)[0] ?? "";
  return !first || /^(the|a|an)$/i.test(first) ? name : first;
}

/** 950 -> "950", 14235 -> "14.2k", 1200000 -> "1.2m". */
export function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
