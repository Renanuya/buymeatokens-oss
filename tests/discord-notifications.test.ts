import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: null as unknown as PGlite, live: true }));
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

vi.mock("../src/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/db")>();
  return {
    ...original,
    query: async (sql: string, args: unknown[] = []) => {
      let index = 0;
      const result = await mocks.db.query(sql.replace(/\?/g, () => `$${++index}`), args);
      return { rows: result.rows, rowsAffected: result.affectedRows ?? 0 };
    },
  };
});
vi.mock("../src/lib/email", () => ({
  deliverEmail: vi.fn(),
  emailConfigured: () => true,
  liveEmailEnabled: () => mocks.live,
  testEmailRecipient: () => "ops@example.com",
}));

import { deleteAccount } from "../src/lib/account-deletion";
import { decrypt, encrypt } from "../src/lib/crypto";
import { SCHEMA, query } from "../src/lib/db";
import { discordPayload, discordText, parseDiscordWebhook, storedDiscordHint } from "../src/lib/discord";
import {
  connectDiscordWebhook,
  processDiscordNotifications,
  sendDiscordMessage,
} from "../src/lib/discord-notifications";
import { redactSecrets } from "../src/lib/redact";
import { getUserById, setDiscordWebhook } from "../src/lib/users";

const MIN = 60_000;
const T = 1_800_000_000_000;
const ID = "123456789012345678";
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFGHIJKLMNOPQRSTUVWXYZabcd";
const URL_OK = `https://discord.com/api/webhooks/${ID}/${TOKEN}`;
let seq = 0;
const fetchMock = vi.fn();

// PGlite's multi-statement call, by index.
const script = (sql: string) => mocks.db["exec"](sql);
const ok = () => new Response(null, { status: 204 });
const status = (code: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status: code });

async function creator(id = "maker", webhook: string | null = URL_OK, connectedAt = T) {
  await query(
    "INSERT INTO users (id, auth_id, login, email, username, display_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, `github:${id}`, id, `${id}@example.com`, id, "Ada Lovelace", T - 86_400_000],
  );
  if (webhook) await setDiscordWebhook(id, encrypt(webhook), connectedAt);
}

async function paid(input: { at: number; name?: string; message?: string; cents?: number; mode?: string; units?: number; creatorId?: string }) {
  const id = `don-${++seq}`;
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, supporter_name, message, status, created_at, paid_at)
     VALUES (?, ?, ?, 'paypal', ?, ?, ?, ?, 'paid', ?, ?)`,
    [id, input.creatorId ?? "maker", input.mode ?? "live", input.units ?? 3, input.cents ?? 1500, input.name ?? "Grace", input.message ?? "", input.at - 1, input.at],
  );
  return id;
}

async function rows() {
  const { rows: r } = await query("SELECT donation_id, status, attempt_count, retry_at FROM discord_notifications ORDER BY donation_id");
  return r as { donation_id: string; status: string; attempt_count: number; retry_at: number | null }[];
}
const sentBody = (call = 0) => JSON.parse(String(fetchMock.mock.calls[call][1].body)) as { content: string; allowed_mentions: { parse: string[] }; flags: number };

describe("webhook URL allow-list", () => {
  const good = [
    URL_OK,
    `https://discordapp.com/api/webhooks/${ID}/${TOKEN}`,
    `https://canary.discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://ptb.discord.com/api/webhooks/${ID}/${TOKEN}`,
    `HTTPS://DISCORD.COM/api/webhooks/${ID}/${TOKEN}`,
    `https://discord.com:443/api/webhooks/${ID}/${TOKEN}`,
    `  ${URL_OK}\n`,
  ];
  it.each(good)("accepts %j and saves it as discord.com", (url) => {
    expect(parseDiscordWebhook(url)?.url).toBe(URL_OK);
  });

  it("drops a query string and fragment, so ?wait= and thread_id never go out", () => {
    expect(parseDiscordWebhook(`${URL_OK}?wait=true&thread_id=5#x`)?.url).toBe(URL_OK);
  });

  const bad = [
    `https://discord.com.evil.com/api/webhooks/${ID}/${TOKEN}`,
    `https://evil.com/discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://discord.com@evil.com/api/webhooks/${ID}/${TOKEN}`,
    `https://user:pw@discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://evildiscord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://notdiscord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://cdn.discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://discord.com:8443/api/webhooks/${ID}/${TOKEN}`,
    `http://discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://162.159.135.232/api/webhooks/${ID}/${TOKEN}`,
    `https://[::1]/api/webhooks/${ID}/${TOKEN}`,
    `https://discord.com./api/webhooks/${ID}/${TOKEN}`,
    `https://discord.com/API/webhooks/${ID}/${TOKEN}`,
    `https://discord.com/api/webhooks/${ID}/${TOKEN}/`,
    `https://discord.com/api/webhooks/${ID}/${TOKEN}/github`,
    `https://discord.com/api/v10/webhooks/${ID}/${TOKEN}`,
    `https://discord.com/x/../api/webhooks/${ID}/x`,
    `https://discord.com/api/webhooks/abc/${TOKEN}`,
    `https://discord.com/api/webhooks/${ID}`,
    `https://discord.com/api/webhooks/${ID}/short`,
    `https://discord.com/api/webhooks/${ID}/${TOKEN}%2f..`,
    `https://discord.com\\@evil.com/api/webhooks/${ID}/${TOKEN}`,
    `javascript:alert(1)`,
    "discord.com/api/webhooks/1/2",
    "",
  ];
  it.each(bad)("rejects %j", (url) => {
    expect(parseDiscordWebhook(url)).toBeNull();
  });
  it("rejects non-strings", () => {
    expect(parseDiscordWebhook(null)).toBeNull();
    expect(parseDiscordWebhook({ toString: () => URL_OK })).toBeNull();
  });
});

describe("message text", () => {
  const sneaky = String.fromCharCode(0x202e, 0x200b, 0x2066, 0xfeff, 0x0007);
  const sneakyRe = new RegExp(`[${sneaky}]`);

  it("drops blank-looking fillers, flattens towers of accents and keeps a leading number from becoming a list", () => {
    expect(discordText("ㅤ", 40, 60)).toBe("");
    expect(discordText("⠀ᅟᅠﾠ", 40, 60)).toBe("");
    expect(discordText(`Z${"́".repeat(150)}`, 200, 240)).toBe(`Z${"́".repeat(3)}`);
    expect(discordText("Café ủng hộ", 200, 240)).toBe("Café ủng hộ");
    expect(discordText("1. not a list", 200, 240)).toBe("1\\. not a list");
  });

  it("neutralises mentions, masked links and invites", () => {
    const text = discordText("@everyone @here <@123> <@&456> <#789> [free](https://evil.com/x) discord.gg/abc https://discord.com/invite/xyz **b** __u__ `c` ||s||", 200, 400);
    for (const bad of ["@everyone", "@here", "<@", "<#", "](", "evil.com", "discord.gg", "discord.com", "https:", "**", "||"]) {
      expect(text).not.toContain(bad);
    }
  });

  it("strips control, zero-width and bidi characters", () => {
    expect(discordText(`Gra${sneaky}ce`, 40, 60)).toBe("Gra ce");
    expect(discordText(`a${sneaky}b\r\n\tc`, 40, 60)).not.toMatch(sneakyRe);
    expect(discordText("a\r\nb", 40, 60)).toBe("a b");
  });

  it("keeps ordinary text readable", () => {
    expect(discordText("Love the CLI, thanks!", 200, 400)).toBe("Love the CLI, thanks!");
    expect(discordText("v1.2 is great", 200, 400)).toBe("v1.2 is great");
  });

  it("caps lengths by code point", () => {
    expect(Array.from(discordText("😀".repeat(500), 200, 400))).toHaveLength(201);
    expect(discordText("*".repeat(500), 200, 240).length).toBeLessThanOrEqual(241);
  });

  it("keeps even the worst-case batch under Discord's 2000 characters", () => {
    const item = { supporterName: "*".repeat(100), message: "*".repeat(5000), units: 1000, test: true };
    const payload = discordPayload(Array.from({ length: 30 }, () => item), "https://buymeatokens.com/ada");
    expect(payload.content.length).toBeLessThanOrEqual(2000);
    expect(payload.content).toContain("more");
  });
});

describe("Discord notifications", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await script(SCHEMA);
  });
  beforeEach(async () => {
    await script("TRUNCATE users CASCADE; TRUNCATE ops_events");
    mocks.live = true;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    await creator();
  });

  it("applies the schema twice without trouble", async () => {
    await script(SCHEMA);
    await script(SCHEMA);
  });

  it("posts one message for a payment, however often the worker looks, and stores the URL encrypted", async () => {
    const at = T + MIN;
    const id = await paid({ at, name: "Grace", message: "Love the CLI!", cents: 123_456 });

    expect(await processDiscordNotifications(at + MIN)).toMatchObject({ sent: 1 });
    expect(await processDiscordNotifications(at + 2 * MIN)).toMatchObject({ sent: 0 });
    expect(await processDiscordNotifications(at + 60 * MIN)).toMatchObject({ sent: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL_OK);
    expect(init).toMatchObject({ method: "POST", redirect: "manual" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = sentBody();
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.flags).toBe(4);
    expect(body.content).toContain("**Grace** bought 3M AI tokens");
    expect(body.content).toContain("> Love the CLI!");
    expect(body.content).not.toMatch(/\$|1234|cents|USD/i);
    // The link is the creator's public page, not their dashboard: the channel is their community.
    expect(body.content).toMatch(/<https?:\/\/[^>]+\/maker>$/);
    expect(body.content).not.toContain("/dashboard");
    expect(await rows()).toEqual([{ donation_id: id, status: "sent", attempt_count: 1, retry_at: null }]);

    const { rows: u } = await query("SELECT discord_webhook_enc FROM users WHERE id = 'maker'");
    const stored = String(u[0].discord_webhook_enc);
    expect(stored).not.toContain("discord.com");
    expect(stored).not.toContain(TOKEN);
    expect(decrypt(stored)).toBe(URL_OK);
  });

  it("can't post a payment twice when two workers overlap", async () => {
    const at = T + MIN;
    await paid({ at });
    let release!: () => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { release = () => resolve(ok()); }));

    const first = sendDiscordMessage("maker", at + MIN);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await sendDiscordMessage("maker", at + MIN)).toBe("none");
    release();
    expect(await first).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't use the email claim table", async () => {
    await paid({ at: T + MIN });
    await processDiscordNotifications(T + 2 * MIN);
    const { rows: r } = await query("SELECT COUNT(*)::int AS n FROM support_notifications");
    expect(r[0].n).toBe(0);
  });

  it("retries a 429 after the longer of retry_after and five minutes, then succeeds", async () => {
    const at = T + MIN;
    const id = await paid({ at });
    fetchMock.mockImplementationOnce(async () => status(429, { retry_after: 1.5, global: false }));

    await processDiscordNotifications(at + MIN);
    expect(await rows()).toEqual([{ donation_id: id, status: "failed", attempt_count: 1, retry_at: at + MIN + 5 * MIN }]);
    await processDiscordNotifications(at + 3 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await processDiscordNotifications(at + 7 * MIN)).toMatchObject({ sent: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await rows()).toEqual([{ donation_id: id, status: "sent", attempt_count: 2, retry_at: null }]);
  });

  it("waits for a long retry_after", async () => {
    const at = T + MIN;
    await paid({ at });
    fetchMock.mockImplementationOnce(async () => status(429, { retry_after: 900 }));
    await processDiscordNotifications(at + MIN);
    await processDiscordNotifications(at + 10 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await processDiscordNotifications(at + 17 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after three rate-limited attempts", async () => {
    const at = T + MIN;
    await paid({ at });
    fetchMock.mockImplementation(async () => status(429, { retry_after: 1 }));
    for (let i = 1; i <= 6; i++) await processDiscordNotifications(at + i * 6 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await rows())[0]).toMatchObject({ status: "failed", attempt_count: 3 });
  });

  it.each([401, 403, 404])("a %i means the webhook is gone: disconnect, skip, tell the operator, stop", async (code) => {
    const at = T + MIN;
    await paid({ at });
    fetchMock.mockImplementation(async () => status(code));

    expect(await processDiscordNotifications(at + MIN)).toMatchObject({ disabled: 1 });
    expect(await getUserById("maker")).toMatchObject({ discordWebhookEnc: null, discordConnectedAt: null, discordFailedAt: at + MIN });
    expect((await rows())[0].status).toBe("skipped");
    const { rows: ops } = await query("SELECT tag FROM ops_events");
    expect(ops).toEqual([{ tag: "[discord] webhook stopped working" }]);

    await paid({ at: at + 20 * MIN });
    await processDiscordNotifications(at + 40 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a late 404 doesn't disconnect a webhook pasted while the request was in flight", async () => {
    const at = T + MIN;
    await paid({ at });
    const replacement = `https://discord.com/api/webhooks/${ID}/${"n".repeat(40)}`;
    fetchMock.mockImplementation(async () => {
      await setDiscordWebhook("maker", encrypt(replacement), at);
      return status(404);
    });
    expect(await sendDiscordMessage("maker", at + MIN)).toBe("failed");
    expect(decrypt((await getUserById("maker"))!.discordWebhookEnc!)).toBe(replacement);
    // No false "stopped working" alert, and the payment goes to the new webhook on the next tick.
    expect((await query("SELECT tag FROM ops_events")).rows).toEqual([]);
    fetchMock.mockImplementation(async () => status(204));
    expect(await sendDiscordMessage("maker", at + 2 * MIN)).toBe("sent");
  });

  it.each([
    ["a 500", async () => status(500)],
    ["a 502", async () => status(502)],
    ["a timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
    ["a network error", async () => { throw new TypeError("fetch failed"); }],
  ])("never resends after %s: it may have been posted", async (_name, answer) => {
    const at = T + MIN;
    await paid({ at });
    fetchMock.mockImplementation(answer);
    await processDiscordNotifications(at + MIN);
    await processDiscordNotifications(at + 60 * MIN);
    await processDiscordNotifications(at + 24 * 60 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await rows())[0].status).toBe("unknown");
    expect((await getUserById("maker"))!.discordWebhookEnc).not.toBeNull();
  });

  it("treats a redirect as a failure and doesn't repeat it", async () => {
    const at = T + MIN;
    await paid({ at });
    fetchMock.mockImplementation(async () => new Response(null, { status: 307, headers: { location: "https://evil.com/" } }));
    await processDiscordNotifications(at + MIN);
    await processDiscordNotifications(at + 60 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
    expect((await rows())[0]).toMatchObject({ status: "failed", retry_at: null });
  });

  it("validates the stored URL again before sending, and never requests a bad one", async () => {
    const at = T + MIN;
    await paid({ at });
    await setDiscordWebhook("maker", encrypt(`https://evil.com/api/webhooks/${ID}/${TOKEN}`), T);
    expect(await processDiscordNotifications(at + MIN)).toMatchObject({ disabled: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("batches: one message lists five supporters and counts the rest, then the next batch waits ten minutes", async () => {
    const at = T + MIN;
    for (let i = 0; i < 7; i++) await paid({ at: at + i, name: `Person${i}` });

    await processDiscordNotifications(at + MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const content = sentBody().content;
    expect(content.match(/^• /gm)).toHaveLength(5);
    expect(content).toContain("…and 2 more");
    expect(content).toContain("Person0");
    expect(content).not.toContain("Person5");

    await paid({ at: at + 2 * MIN, name: "Late" });
    await processDiscordNotifications(at + 5 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await processDiscordNotifications(at + 12 * MIN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBody(1).content).toContain("**Late** bought");
  });

  it("shows an anonymous supporter as Someone, like the page", async () => {
    await paid({ at: T + MIN, name: "   " });
    await processDiscordNotifications(T + 2 * MIN);
    expect(sentBody().content).toContain("**Someone** bought 3M AI tokens");
  });

  it("follows the public page: a test payment only posts, labelled, while the creator is in test mode", async () => {
    await paid({ at: T + MIN, mode: "test", name: "Tester" });
    expect(await processDiscordNotifications(T + 2 * MIN)).toMatchObject({ sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    await query("UPDATE users SET stripe_mode = 'test' WHERE id = 'maker'");
    await processDiscordNotifications(T + 3 * MIN);
    expect(sentBody().content).toContain("**Tester** bought 3M AI tokens (test)");
  });

  it("makes hostile names and messages inert and keeps the whole payload short", async () => {
    const at = T + MIN;
    for (let i = 0; i < 6; i++) {
      await paid({
        at: at + i,
        name: `@everyone <@123> <@&456> <#789> [x](https://evil.com) ${String.fromCharCode(0x202e)}`,
        message: `@here <@&1> discord.gg/abc [click](https://evil.com) ${"@everyone *_`~|".repeat(400)}`,
      });
    }
    await processDiscordNotifications(at + MIN);
    const body = sentBody();
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.content.length).toBeLessThanOrEqual(2000);
    const supporterText = body.content.split("\n").filter((l) => l.startsWith("•") || l.startsWith(">")).join("\n");
    expect(supporterText).not.toMatch(/@everyone|@here|<[@#:]|\]\(|evil\.com|discord\.gg/);
    expect(supporterText).not.toContain(String.fromCharCode(0x202e));
  });

  it("announces only support paid after the webhook was connected", async () => {
    await paid({ at: T - 1, name: "Before" });
    await paid({ at: T + MIN, name: "After" });
    await processDiscordNotifications(T + 2 * MIN);
    const content = sentBody().content;
    expect(content).not.toContain("Before");
    expect(content).toContain("After");
  });

  it("sends what is waiting to a replaced webhook, but no history after a disconnect", async () => {
    await paid({ at: T + MIN, name: "Waiting" });
    // Moved to another channel before the first message went out: what was waiting goes there.
    await setDiscordWebhook("maker", encrypt(URL_OK), T + 5 * MIN);
    await processDiscordNotifications(T + 6 * MIN);
    expect(sentBody().content).toContain("Waiting");

    fetchMock.mockClear();
    await paid({ at: T + 7 * MIN, name: "Before" });
    await setDiscordWebhook("maker", null);
    await setDiscordWebhook("maker", encrypt(URL_OK), T + 8 * MIN);
    await paid({ at: T + 9 * MIN, name: "After" });
    await processDiscordNotifications(T + 30 * MIN);
    expect(sentBody().content).toContain("After");
    expect(sentBody().content).not.toContain("Before");
  });

  it("posts nothing for creators without a webhook, and nothing while live sending is off", async () => {
    await creator("plain", null);
    await paid({ at: T + MIN, creatorId: "plain" });
    await processDiscordNotifications(T + 2 * MIN);
    expect(fetchMock).not.toHaveBeenCalled();
    await paid({ at: T + MIN });
    mocks.live = false;
    expect(await processDiscordNotifications(T + 2 * MIN)).toMatchObject({ testMode: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores support older than a week and unpaid support", async () => {
    await paid({ at: T + MIN });
    await query("UPDATE donations SET status = 'pending'");
    await processDiscordNotifications(T + 2 * MIN);
    await processDiscordNotifications(T + 8 * 86_400_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops starting creators once the time budget is spent", async () => {
    await paid({ at: T + MIN });
    expect(await processDiscordNotifications(T + 2 * MIN, Date.now() - 1)).toMatchObject({ deferred: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it("removes the Discord rows and the encrypted URL with the account", async () => {
    await paid({ at: T + MIN });
    await processDiscordNotifications(T + 2 * MIN);
    expect(await rows()).toHaveLength(1);
    await deleteAccount("maker", "self_service", T + 3 * MIN);
    expect(await rows()).toEqual([]);
    const { rows: u } = await query("SELECT COUNT(*)::int AS n FROM users WHERE id = 'maker'");
    expect(u[0].n).toBe(0);
  });
});

describe("connecting", () => {
  beforeEach(async () => {
    await script("TRUNCATE users CASCADE");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await creator("maker", null);
  });

  it("saves it encrypted after asking Discord with a GET, and shows only the last four characters", async () => {
    expect(await connectDiscordWebhook("maker", `${URL_OK}?wait=true`, T)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(URL_OK);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "manual" });
    const user = (await getUserById("maker"))!;
    expect(user.discordConnectedAt).toBe(T);
    expect(user.discordWebhookEnc).not.toContain(TOKEN);
    expect(storedDiscordHint(user.discordWebhookEnc)).toBe(TOKEN.slice(-4));
    expect(storedDiscordHint("garbage")).toBeNull();
  });

  it("refuses a bad URL without making a request", async () => {
    const result = await connectDiscordWebhook("maker", "https://discord.com.evil.com/api/webhooks/1/2");
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await getUserById("maker"))!.discordWebhookEnc).toBeNull();
  });

  it("refuses a webhook Discord doesn't know, and one it can't reach", async () => {
    fetchMock.mockImplementationOnce(async () => status(404));
    expect(await connectDiscordWebhook("maker", URL_OK)).toMatchObject({ ok: false, error: expect.stringContaining("doesn't know") });
    fetchMock.mockImplementationOnce(async () => { throw new TypeError("fetch failed"); });
    expect(await connectDiscordWebhook("maker", URL_OK)).toMatchObject({ ok: false, error: expect.stringContaining("Try again") });
    expect((await getUserById("maker"))!.discordWebhookEnc).toBeNull();
  });

  it("checks a pasted webhook at most 5 times per 10 minutes, so nobody can make the server hammer Discord", async () => {
    fetchMock.mockImplementation(async () => status(401));
    const tries = await Promise.all(Array.from({ length: 8 }, () => connectDiscordWebhook("maker", URL_OK, T)));
    expect(tries.filter((r) => !r.ok && r.error.includes("doesn't know"))).toHaveLength(5);
    expect(tries.filter((r) => !r.ok && r.error.includes("tries"))).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    // A URL that isn't a webhook never reaches Discord and doesn't use up a check.
    await connectDiscordWebhook("maker", "https://example.com/hook", T);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    fetchMock.mockImplementation(async () => status(200));
    expect(await connectDiscordWebhook("maker", URL_OK, T + 10 * MIN)).toEqual({ ok: true });
  });

  it("clears the stopped-working notice when a new one is connected, and disconnecting forgets it", async () => {
    await query("UPDATE users SET discord_failed_at = 5 WHERE id = 'maker'");
    await connectDiscordWebhook("maker", URL_OK, T);
    expect((await getUserById("maker"))!.discordFailedAt).toBeNull();
    await setDiscordWebhook("maker", null);
    expect(await getUserById("maker")).toMatchObject({ discordWebhookEnc: null, discordConnectedAt: null });
  });
});

describe("log redaction", () => {
  it("blanks out webhook URLs", () => {
    expect(redactSecrets(`failed for ${URL_OK} twice`)).toBe("failed for [redacted] twice");
    expect(redactSecrets(`https://discordapp.com/api/webhooks/${ID}/${TOKEN}`)).toBe("[redacted]");
    // Without a scheme, with an API version, and percent-encoded.
    expect(redactSecrets(`discord.com/api/webhooks/${ID}/${TOKEN}`)).toBe("[redacted]");
    expect(redactSecrets(`https://discord.com/api/v10/webhooks/${ID}/${TOKEN}`)).toBe("[redacted]");
    expect(redactSecrets(`url=https%3A%2F%2Fdiscord.com%2Fapi%2Fwebhooks%2F${ID}%2F${TOKEN}`)).toBe("url=[redacted]");
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await mocks.db.close();
});
