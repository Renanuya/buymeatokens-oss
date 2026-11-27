// One webhook attempt: re-check the URL, resolve it, refuse blocked addresses, then connect to the address that was
// checked. Used by the delivery worker and the "send a test event" button alike, so both have the same limits.

import https from "node:https";
import { checkWebhookUrl, resolveAll, type Resolver } from "./webhook-url";

export const SEND_TIMEOUT_MS = 5000;

/** What the caller learns: the status code, or that nothing usable came back. Never a body or a reason. */
export type SendResult = { status: number } | { status: null };

export type HttpsPost = (req: { url: URL; address: string; headers: Record<string, string>; body: string; timeoutMs: number }) => Promise<SendResult>;

/**
 * POSTs through node:https with a `lookup` that returns the address we validated, so a second DNS answer (rebinding)
 * is never used. The Host header and the TLS server name stay the host name, so certificates verify as usual.
 * No redirects are followed (a 3xx is just a non-2xx status), no proxy settings are read (a fresh Agent), and the
 * response body is never read: the status is all we keep.
 */
export const httpsPost: HttpsPost = ({ url, address, headers, body, timeoutMs }) =>
  new Promise((resolve) => {
    const family = address.includes(":") ? 6 : 4;
    const host = url.hostname.replace(/\.$/, "");
    const req = https.request({
      method: "POST",
      hostname: host,
      port: 443,
      path: `${url.pathname}${url.search}`,
      servername: host,
      headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
      agent: new https.Agent({ keepAlive: false }),
      lookup: (_name, options, callback) => {
        const cb = callback as (err: Error | null, a: unknown, f?: number) => void;
        if ((options as { all?: boolean }).all) cb(null, [{ address, family }]);
        else cb(null, address, family);
      },
      timeout: timeoutMs,
    });
    // One deadline for connect, TLS and response together.
    const timer = setTimeout(() => req.destroy(), timeoutMs);
    const done = (result: SendResult) => {
      clearTimeout(timer);
      resolve(result);
    };
    req.on("response", (res) => {
      res.destroy();
      done({ status: res.statusCode ?? null });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => done({ status: null }));
    req.end(body);
  });

export type SendDeps = { resolve?: Resolver; post?: HttpsPost; timeoutMs?: number };

/** Validates, resolves and sends. Resolution is part of the same deadline as the request. */
export async function sendWebhook(url: string, headers: Record<string, string>, body: string, deps: SendDeps = {}): Promise<SendResult> {
  const timeoutMs = deps.timeoutMs ?? SEND_TIMEOUT_MS;
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<SendResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: null }), timeoutMs);
  });
  const attempt = (async (): Promise<SendResult> => {
    try {
      const checked = await checkWebhookUrl(url, deps.resolve ?? resolveAll);
      if ("error" in checked) return { status: null };
      const left = Math.max(1, timeoutMs - (Date.now() - started));
      return await (deps.post ?? httpsPost)({ url: checked.url, address: checked.address, headers, body, timeoutMs: left });
    } catch {
      return { status: null };
    }
  })();
  try {
    return await Promise.race([attempt, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
