import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const https = vi.hoisted(() => ({
  options: null as null | Record<string, unknown>,
  written: "",
  destroyed: false,
  response: { statusCode: 204, destroy: vi.fn() },
}));

vi.mock("node:https", () => {
  class Agent {}
  const request = (options: Record<string, unknown>) => {
    https.options = options;
    const handlers: Record<string, (arg?: unknown) => void> = {};
    return {
      on(event: string, fn: (arg?: unknown) => void) {
        handlers[event] = fn;
        return this;
      },
      end(body: string) {
        https.written = body;
        queueMicrotask(() => handlers.response?.(https.response));
      },
      destroy() {
        https.destroyed = true;
      },
    };
  };
  return { default: { request, Agent } };
});

import { redactSecrets } from "../src/lib/redact";
import { httpsPost, sendWebhook, type HttpsPost } from "../src/lib/webhook-send";
import { signBody, USER_AGENT, webhookHeaders } from "../src/lib/webhook-sign";

describe("signature", () => {
  it("matches a fixed test vector", () => {
    const body = JSON.stringify({ id: "evt_1", type: "support.confirmed" });
    expect(signBody("bmtwh_testsecret", 1_700_000_000, body)).toBe("4980ba792fc5335e1de18a4ecac82b056a41688fb3dd99c0e705820664203a20");
    const headers = webhookHeaders({ eventId: "evt_1", eventType: "support.confirmed", body, secrets: ["bmtwh_testsecret"], now: 1_700_000_000_999 });
    expect(headers).toEqual({
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      "BMT-Event-Id": "evt_1",
      "BMT-Event-Type": "support.confirmed",
      "BMT-Signature": "t=1700000000,v1=4980ba792fc5335e1de18a4ecac82b056a41688fb3dd99c0e705820664203a20",
    });
  });

  it("signs with both secrets during a rotation, and each verifies on its own", () => {
    const body = "{}";
    const h = webhookHeaders({ eventId: "e", eventType: "t", body, secrets: ["new", "old"], now: 5000 })["BMT-Signature"];
    const entries = h.split(",");
    expect(entries[0]).toBe("t=5");
    expect(entries.slice(1)).toEqual([
      `v1=${createHmac("sha256", "new").update("5.{}").digest("hex")}`,
      `v1=${createHmac("sha256", "old").update("5.{}").digest("hex")}`,
    ]);
  });

  it("redacts the secret prefix from logs", () => {
    expect(redactSecrets("failed with bmtwh_AbC-123_xyz in it")).toBe("failed with [redacted] in it");
    // Also when it follows a word character, where  finds no boundary.
    expect(redactSecrets("secret=x_bmtwh_AbC-123_xyz")).toBe("secret=x_[redacted]");
  });
});

describe("sendWebhook", () => {
  const headers = { "Content-Type": "application/json" };
  const ok: HttpsPost = async () => ({ status: 200 });

  it("connects to the address it validated, resolving the name only once", async () => {
    const answers = [["93.184.216.34"], ["127.0.0.1"]];
    const resolve = vi.fn(async () => answers.shift() ?? ["127.0.0.1"]);
    const post = vi.fn(ok);
    await sendWebhook("https://rebind.example.com/hook", headers, "{}", { resolve, post });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0].address).toBe("93.184.216.34");
  });

  it("never sends to a blocked address, and says only that it failed", async () => {
    const post = vi.fn(ok);
    for (const ip of ["10.0.0.1", "169.254.169.254", "::1"]) {
      expect(await sendWebhook("https://a.example.com/", headers, "{}", { resolve: async () => [ip], post })).toEqual({ status: null });
    }
    expect(await sendWebhook("https://a.example.com/", headers, "{}", { resolve: async () => ["93.184.216.34", "10.0.0.1"], post })).toEqual({ status: null });
    expect(await sendWebhook("http://a.example.com/", headers, "{}", { resolve: async () => ["93.184.216.34"], post })).toEqual({ status: null });
    expect(post).not.toHaveBeenCalled();
  });

  it("reports a redirect as its status and never follows it", async () => {
    const post = vi.fn<HttpsPost>(async () => ({ status: 302 }));
    expect(await sendWebhook("https://a.example.com/", headers, "{}", { resolve: async () => ["93.184.216.34"], post })).toEqual({ status: 302 });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("gives up at the deadline, and counts a hung lookup too", async () => {
    const hang: HttpsPost = () => new Promise(() => {});
    expect(await sendWebhook("https://a.example.com/", headers, "{}", { resolve: async () => ["93.184.216.34"], post: hang, timeoutMs: 30 })).toEqual({ status: null });
    expect(await sendWebhook("https://a.example.com/", headers, "{}", { resolve: () => new Promise(() => {}), post: ok, timeoutMs: 30 })).toEqual({ status: null });
  });

  it("turns a throwing sender into a failure", async () => {
    const post: HttpsPost = async () => { throw new Error("boom"); };
    expect(await sendWebhook("https://a.example.com/", headers, "{}", { resolve: async () => ["93.184.216.34"], post })).toEqual({ status: null });
  });
});

describe("the real HTTPS request", () => {
  beforeEach(() => {
    https.options = null;
    https.destroyed = false;
    https.response.destroy.mockClear();
  });

  it("connects through a lookup that returns the validated address, keeping the host name for TLS", async () => {
    const url = new URL("https://hooks.example.com/a/b?x=1");
    const result = await httpsPost({ url, address: "93.184.216.34", headers: { "BMT-Event-Id": "e" }, body: "{}", timeoutMs: 1000 });
    const o = https.options!;
    expect(result).toEqual({ status: 204 });
    expect(o).toMatchObject({ method: "POST", hostname: "hooks.example.com", servername: "hooks.example.com", port: 443, path: "/a/b?x=1" });
    expect(o.rejectUnauthorized).toBeUndefined(); // certificate verification stays on
    expect(o.headers).toMatchObject({ "BMT-Event-Id": "e", "Content-Length": "2" });
    expect(o.headers).not.toHaveProperty("Host"); // Node sets Host to the name
    expect(https.written).toBe("{}");
    const lookup = o.lookup as (n: string, opts: object, cb: (...a: unknown[]) => void) => void;
    const single = vi.fn();
    lookup("hooks.example.com", {}, single);
    expect(single).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    const all = vi.fn();
    lookup("hooks.example.com", { all: true }, all);
    expect(all).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
    expect(https.response.destroy).toHaveBeenCalled(); // the body is never read
  });

  it("uses the family of an IPv6 address", async () => {
    await httpsPost({ url: new URL("https://hooks.example.com/"), address: "2606:4700:4700::1111", headers: {}, body: "", timeoutMs: 1000 });
    const cb = vi.fn();
    (https.options!.lookup as (n: string, o: object, cb: (...a: unknown[]) => void) => void)("x", {}, cb);
    expect(cb).toHaveBeenCalledWith(null, "2606:4700:4700::1111", 6);
  });
});
