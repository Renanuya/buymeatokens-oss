import type { Instrumentation } from "next";

/**
 * Every uncaught server error (pages, route handlers, server actions) is grouped into ops_events and mailed to the
 * operator by the minute email worker (src/lib/ops.ts). Redirects and not-found are control flow and never get here.
 * The route pattern is kept, not the address, so a creator's page shows as /[username], never a username.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The import sits inside the check so the edge bundle drops it: ops.ts needs Node (crypto, Postgres).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordOpsEvent } = await import("./lib/ops");
    await recordOpsEvent(`[server] ${request.method} ${context.routePath}`.slice(0, 80), [error]);
  }
};
