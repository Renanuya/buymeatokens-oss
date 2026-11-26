export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/** Password-less local login. Never available in production builds. */
export function devLoginEnabled(): boolean {
  return !isProduction() && process.env.DEV_LOGIN === "true";
}

/** In development, let Stripe test-mode payments count toward the free limit. */
export function countTestPaymentsForBilling(): boolean {
  return !isProduction() && process.env.BILLING_COUNT_TEST_MODE === "true";
}

/** New pages earn lifetime free access until the operator explicitly closes early access. */
export function earlyAccessOpen(): boolean {
  return process.env.EARLY_ACCESS_OPEN !== "false";
}

/** Paddle credentials alone never activate billing. */
export function billingEnforced(): boolean {
  return process.env.BILLING_ENABLED === "true" && paddleClientConfig().configured && Boolean(process.env.PADDLE_WEBHOOK_SECRET);
}

export function paddleClientConfig() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
  const monthlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY ?? "";
  const yearlyPriceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_YEARLY ?? "";
  const environment: "sandbox" | "production" =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";
  return {
    token,
    monthlyPriceId,
    yearlyPriceId,
    environment,
    configured: Boolean(token && monthlyPriceId && yearlyPriceId),
  };
}
