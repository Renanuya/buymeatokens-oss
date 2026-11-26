import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  getCurrentUser: vi.fn(),
  requireCreator: vi.fn(),
}));
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
vi.mock("../src/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
  requireCreator: mocks.requireCreator,
}));

import { SCHEMA, query } from "../src/lib/db";
import { recordBadgeCopy, registrationOverview } from "../src/lib/creator-activity";
import { trackBadgeCopy } from "../src/app/dashboard/badge-actions";
import AdminPage from "../src/app/admin/page";
import { creatorEmail, enrollCreatorEmails, sendCreatorWelcome, sendCreatorReminder, sendCreatorEmailTest,
  processCreatorEmails, getCreatorEmailRecipient, backfillCandidates, backfillCreatorReminder,
  WELCOME_TEMPLATE, REMINDER_TEMPLATE, REMINDER_DELAY } from "../src/lib/creator-emails";
import { upsertAuthUser } from "../src/lib/users";
import { POST as emailCron } from "../src/app/api/cron/emails/route";

const NOW = 1_800_000_000_000;

async function account(id: string, username: string | null = id, authId = `github:${id}`, createdAt = NOW) {
  await query(
    "INSERT INTO users (id, auth_id, login, username, display_name, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, authId, id, username, id, `${id}@example.com`, createdAt],
  );
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.stubEnv("ADMIN_GITHUB_LOGINS", "owner");
  mocks.getCurrentUser.mockReset().mockResolvedValue({ login: "owner", authId: "github:1" });
  mocks.requireCreator.mockReset().mockResolvedValue({ id: "maker", username: "maker" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await mocks.db.close(); });

describe("badge adoption and registrations", () => {
  it("counts repeated copies separately from distinct creators and includes incomplete signups", async () => {
    await account("maker");
    await account("second");
    await account("new-signup", null, "github:new-signup", NOW + 1);
    await account("demo", "demo", "dev:demo", NOW + 2);
    await Promise.all([recordBadgeCopy("maker", "button"), recordBadgeCopy("maker", "button")]);
    vi.mocked(Date.now).mockReturnValue(NOW + 1000);
    await recordBadgeCopy("maker", "compact");
    await recordBadgeCopy("second", "button");
    await recordBadgeCopy("demo", "button");

    const result = await registrationOverview();
    expect(result.stats).toEqual({ registrations: 3, creatorPages: 2, badgeCreators: 2, badgeCopies: 4 });
    expect(result.registrations[0]).toMatchObject({ id: "new-signup", username: null, badgeCopies: 0, lastCopiedAt: null });
    expect(result.registrations.find((u) => u.id === "maker")).toMatchObject({
      badgeCopies: 3, buttonCopies: 2, compactCopies: 1, lastCopiedAt: NOW + 1000,
    });
    const timestamps = await query("SELECT first_copied_at FROM badge_copy_stats WHERE user_id = ? AND style = ?", ["maker", "button"]);
    expect(Number(timestamps.rows[0].first_copied_at)).toBe(NOW);
    expect(result.registrations.some((u) => u.id === "demo")).toBe(false);
  });

  it("paginates newest registrations and handles invalid or out-of-range pages", async () => {
    for (let i = 0; i < 27; i++) await account(`user-${i}`, null, `github:${i}`, NOW + i);
    const first = await registrationOverview();
    expect(first.registrations).toHaveLength(25);
    expect(first.registrations[0].id).toBe("user-26");
    const last = await registrationOverview(999);
    expect(last.page).toBe(2);
    expect(last.pages).toBe(2);
    expect(last.registrations.map((u) => u.id)).toEqual(["user-1", "user-0"]);
    expect((await registrationOverview(NaN)).page).toBe(1);
    expect((await registrationOverview(-1)).page).toBe(1);
  });

  it("uses the authenticated creator for tracking and rejects invalid styles", async () => {
    await account("maker");
    await trackBadgeCopy("button");
    await trackBadgeCopy("unexpected" as "button");
    expect(mocks.requireCreator).toHaveBeenCalledTimes(1);
    expect((await registrationOverview()).stats.badgeCopies).toBe(1);
    mocks.requireCreator.mockRejectedValueOnce(new Error("Authentication required"));
    await expect(trackBadgeCopy("compact")).rejects.toThrow("Authentication required");
    expect((await registrationOverview()).stats.badgeCopies).toBe(1);
  });

  it("renders registrations and email only for admins, including an empty state", async () => {
    await account("maker");
    await recordBadgeCopy("maker", "compact");
    const html = renderToStaticMarkup(await AdminPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Registrations");
    expect(html).toContain("maker@example.com");
    expect(html).toContain("Creators who copied");
    expect(html).not.toContain("Waiting");
    expect(html).not.toContain("Approved");
    for (const viewer of [null, { login: "other-user", authId: "github:2" }, { login: "owner", authId: "dev:owner" }]) {
      mocks.getCurrentUser.mockResolvedValueOnce(viewer);
      await expect(AdminPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    }
    await mocks.db.exec("TRUNCATE users CASCADE");
    const empty = renderToStaticMarkup(await AdminPage({ searchParams: Promise.resolve({}) }));
    expect(empty).toContain("No GitHub registrations yet.");
  });
});

describe("registration welcome and one conditional one-hour reminder", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_LIVE_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("APP_URL", "https://buymeatokens.com");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function provider() {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "email-1" }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  function payload(mock: ReturnType<typeof provider>, call = 0) {
    return JSON.parse(String(mock.mock.calls[call]?.[1]?.body));
  }
  async function enroll(id = "maker", username: string | null = id) {
    await account(id, username);
    await enrollCreatorEmails(id);
  }

  it("identifies a new registration once, preserving email on later GitHub lookup outages", async () => {
    const input = { authId: "github:new", login: "maker", email: "first@example.com", name: "Maker", avatarUrl: null };
    const first = await upsertAuthUser(input);
    expect(first.newlyCreated).toBe(true);
    const again = await upsertAuthUser({ ...input, email: null, name: "Other" });
    expect(again.newlyCreated).toBe(false);
    expect(again.id).toBe(first.id);
    expect(again.email).toBe("first@example.com");
    expect(again.displayName).toBe("Maker");
  });

  it("keeps all three templates short, escaped and focused on one action", () => {
    for (const kind of ["welcome", "payment", "badge"] as const) {
      const email = creatorEmail({ name: "<script>alert(1)</script>", username: "maker" }, kind);
      expect(email.html).not.toContain("<script>");
      expect(email.html).toContain("&lt;script&gt;");
      expect(email.html.match(/href=/g)).toHaveLength(1);
      expect(email.text.split(/\s+/).length).toBeLessThan(130);
      expect(email.html).not.toContain("<pre");
      expect(email.html).not.toContain("<img");
    }
    expect(creatorEmail({ name: "Maker", username: null }, "welcome").text).toContain("/onboarding");
    expect(creatorEmail({ name: "Maker", username: "maker" }, "badge").text).toContain("/dashboard#readme-badge");
  });

  it("welcomes new accounts before page setup and regardless of badge adoption, once under concurrency", async () => {
    await enroll("maker", null);
    const fetchMock = provider();
    expect((await Promise.all([sendCreatorWelcome("maker"), sendCreatorWelcome("maker")])).sort()).toEqual(["sent", "skipped"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(payload(fetchMock).subject).toBe("Welcome to buymeatokens");
    expect(payload(fetchMock).text).toContain("/onboarding");
    await enroll("copied"); await recordBadgeCopy("copied", "button");
    expect(await sendCreatorWelcome("copied")).toBe("sent");
  });

  it("does not backfill existing accounts, enroll demos or send without an address/credentials", async () => {
    const fetchMock = provider();
    await account("existing");
    expect(await sendCreatorWelcome("existing")).toBe("skipped");
    await account("demo", "demo", "dev:demo"); await enrollCreatorEmails("demo");
    expect(await getCreatorEmailRecipient("demo")).toBeNull();
    await enroll("no-email"); await query("UPDATE users SET email = NULL WHERE id = ?", ["no-email"]);
    expect(await sendCreatorWelcome("no-email")).toBe("skipped");
    vi.stubEnv("RESEND_API_KEY", ""); await enroll("no-key");
    expect(await sendCreatorWelcome("no-key")).toBe("not_configured");
    expect((await query("SELECT * FROM creator_email_deliveries")).rows).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends no reminder before one hour, then prioritizes a missing payment method even with a copied badge", async () => {
    await enroll(); await recordBadgeCopy("maker", "button"); const fetchMock = provider();
    await sendCreatorWelcome("maker");
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY - 1);
    expect(await sendCreatorReminder("maker")).toBe("skipped");
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY);
    expect(await sendCreatorReminder("maker")).toBe("sent");
    expect(payload(fetchMock, 1).subject).toContain("Connect a payment method");
    expect(payload(fetchMock, 1).text).toContain("/dashboard/stripe");
    expect((await getCreatorEmailRecipient("maker"))?.reminderKind).toBe("payment");
  });

  it.each(["stripe_key_enc", "paypal_email", "usdc_address"])("checks current %s settings and chooses the badge reminder", async (column) => {
    await enroll(); const fetchMock = provider(); await sendCreatorWelcome("maker");
    await query(`UPDATE users SET ${column} = ? WHERE id = ?`, ["connected", "maker"]);
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY);
    expect(await sendCreatorReminder("maker")).toBe("sent");
    expect(payload(fetchMock, 1).subject).toBe("Your README badge is ready to share");
    expect((await getCreatorEmailRecipient("maker"))?.reminderKind).toBe("badge");
  });

  it("cancels the reminder when both steps are complete and never sends it later", async () => {
    await enroll(); const fetchMock = provider(); await sendCreatorWelcome("maker");
    await query("UPDATE users SET paypal_email = ? WHERE id = ?", ["pay@example.com", "maker"]);
    await recordBadgeCopy("maker", "compact");
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY);
    expect(await sendCreatorReminder("maker")).toBe("skipped");
    expect((await getCreatorEmailRecipient("maker"))?.reminderCompletedAt).toBe(NOW + REMINDER_DELAY);
    await query("UPDATE users SET paypal_email = NULL WHERE id = ?", ["maker"]);
    expect(await sendCreatorReminder("maker")).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses one shared follow-up slot under concurrency and never sends a third badge email", async () => {
    await enroll(); const fetchMock = provider(); await sendCreatorWelcome("maker");
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY);
    expect((await Promise.all([sendCreatorReminder("maker"), sendCreatorReminder("maker")])).sort()).toEqual(["sent", "skipped"]);
    await query("UPDATE users SET paypal_email = ? WHERE id = ?", ["pay@example.com", "maker"]);
    expect(await sendCreatorReminder("maker")).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await query("SELECT template FROM creator_email_deliveries ORDER BY template")).rows).toEqual([
      { template: REMINDER_TEMPLATE }, { template: WELCOME_TEMPLATE },
    ]);
  });

  it("recovers welcomes through the worker, processes reminders, and never picks existing accounts", async () => {
    await account("existing"); await enroll(); const fetchMock = provider();
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 1 });
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 0 });
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY);
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 1 });
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(payload(fetchMock).to).toEqual(["maker@example.com"]);
  });

  it("enrolls a new account with temporarily unavailable email and recovers when GitHub supplies it", async () => {
    await account("maker", null); await query("UPDATE users SET email = NULL WHERE id = ?", ["maker"]);
    await enrollCreatorEmails("maker"); const fetchMock = provider();
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 0 });
    await query("UPDATE users SET email = ? WHERE id = ?", ["maker@example.com", "maker"]);
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caps explicit rejection retries with a five-minute delay and blocks all unknown retries", async () => {
    await enroll(); const fetchMock = provider(); fetchMock.mockImplementation(async () => new Response(null, { status: 403 }));
    expect(await sendCreatorWelcome("maker")).toBe("failed");
    expect(await sendCreatorWelcome("maker")).toBe("skipped");
    for (let attempt = 1; attempt <= 2; attempt++) {
      vi.mocked(Date.now).mockReturnValue(NOW + attempt * 300_000);
      expect(await sendCreatorWelcome("maker")).toBe("failed");
    }
    vi.mocked(Date.now).mockReturnValue(NOW + REMINDER_DELAY);
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await enroll("unknown"); fetchMock.mockRejectedValueOnce(new Error("Connection lost"));
    expect(await sendCreatorWelcome("unknown")).toBe("unknown");
    expect(await sendCreatorWelcome("unknown")).toBe("skipped");
    expect(await sendCreatorReminder("unknown")).toBe("skipped");
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("blocks automatic sends in test mode; owner previews never enroll accounts or consume live slots", async () => {
    vi.stubEnv("EMAIL_LIVE_ENABLED", "false"); vi.stubEnv("EMAIL_TEST_TO", "inbox@example.com");
    await account("existing"); await enroll(); const fetchMock = provider();
    expect(await sendCreatorWelcome("maker")).toBe("test_mode");
    expect(await sendCreatorReminder("maker")).toBe("test_mode");
    expect(await processCreatorEmails()).toMatchObject({ testMode: true, sent: 0 });
    for (const kind of ["welcome", "payment", "badge"] as const) expect(await sendCreatorEmailTest("existing", kind)).toBe("sent");
    expect(await sendCreatorEmailTest("existing", "welcome")).toBe("skipped");
    for (const call of fetchMock.mock.calls) {
      const p = JSON.parse(String(call[1]?.body)); expect(p.to).toEqual(["inbox@example.com"]); expect(p.subject).toContain("[TEST]");
    }
    expect((await getCreatorEmailRecipient("existing"))?.enrolled).toBe(false);
    expect((await query("SELECT * FROM creator_email_deliveries WHERE template = ? OR template = ?", [WELCOME_TEMPLATE, REMINDER_TEMPLATE])).rows).toHaveLength(0);
    const { deliverEmail } = await import("../src/lib/email");
    expect(await deliverEmail({ to: "other@example.com", subject: "No", html: "No", text: "No" })).toEqual({ status: "blocked" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses Mailjet From/Reply-To and stores UUID only on message-level success", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "mailjet"); vi.stubEnv("MAILJET_API_KEY", "test-public"); vi.stubEnv("MAILJET_SECRET_KEY", "test-private");
    vi.stubEnv("EMAIL_REPLY_TO", "founder@example.com"); vi.stubEnv("EMAIL_FROM", "buymeatokens <hello@buymeatokens.com>");
    await enroll(); const fetchMock = provider();
    fetchMock.mockResolvedValueOnce(Response.json({ Messages: [{ Status: "success", To: [{ MessageUUID: "mailjet-uuid" }] }] }));
    expect(await sendCreatorWelcome("maker")).toBe("sent");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mailjet.com/v3.1/send");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("test-public:test-private").toString("base64")}` });
    expect(payload(fetchMock).Messages[0]).toMatchObject({ From: { Email: "hello@buymeatokens.com", Name: "buymeatokens" }, To: [{ Email: "maker@example.com" }], ReplyTo: { Email: "founder@example.com" }, TrackOpens: "disabled", TrackClicks: "disabled" });
    expect((await query("SELECT provider_id FROM creator_email_deliveries")).rows[0].provider_id).toBe("mailjet-uuid");
    await enroll("error"); fetchMock.mockResolvedValueOnce(Response.json({ Messages: [{ Status: "error" }] }));
    expect(await sendCreatorWelcome("error")).toBe("failed");
    await enroll("missing"); fetchMock.mockResolvedValueOnce(Response.json({}));
    expect(await sendCreatorWelcome("missing")).toBe("unknown");
  });

  it("protects the scheduled worker with its own secret", async () => {
    vi.stubEnv("EMAIL_CRON_SECRET", "worker-secret"); vi.stubEnv("EMAIL_LIVE_ENABLED", "false"); const fetchMock = provider();
    for (const auth of [undefined, "Bearer wrong"]) {
      expect((await emailCron(new Request("https://example.com/api/cron/emails", { method: "POST", headers: auth ? { authorization: auth } : {} }))).status).toBe(401);
    }
    const res = await emailCron(new Request("https://example.com/api/cron/emails", { method: "POST", headers: { authorization: "Bearer worker-secret" } }));
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ testMode: true, sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backfills existing accounts with one reminder at their due time and never a welcome", async () => {
    await account("nopay");
    await account("payer"); await query("UPDATE users SET paypal_email = ? WHERE id = ?", ["pay@example.com", "payer"]);
    await account("late"); await query("UPDATE users SET usdc_address = ? WHERE id = ?", ["0xabc", "late"]);
    await account("done"); await query("UPDATE users SET paypal_email = ? WHERE id = ?", ["done@example.com", "done"]);
    await recordBadgeCopy("done", "button");
    await account("demo", "demo", "dev:demo");
    await enroll("signup");
    const fetchMock = provider();

    expect((await backfillCandidates()).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "late", login: "late", kind: "badge" }, { id: "nopay", login: "nopay", kind: "payment" }, { id: "payer", login: "payer", kind: "badge" },
    ]);
    const due = NOW + 5 * REMINDER_DELAY;
    for (const id of ["nopay", "payer", "late"]) expect(await backfillCreatorReminder(id, due)).toBe(true);
    expect(await backfillCreatorReminder("nopay", due)).toBe(false);
    expect(await backfillCreatorReminder("signup", due)).toBe(false);
    expect(await backfillCandidates()).toEqual([]);

    // Only the real signup is welcomed; backfilled accounts wait silently for their local morning.
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 1 });
    expect(payload(fetchMock).to).toEqual(["signup@example.com"]);
    expect(await sendCreatorWelcome("payer")).toBe("skipped");
    vi.mocked(Date.now).mockReturnValue(due - 1);
    expect(await sendCreatorReminder("payer")).toBe("skipped");

    await recordBadgeCopy("late", "compact"); // finished setup before the morning: no email
    vi.mocked(Date.now).mockReturnValue(due);
    expect(await processCreatorEmails()).toMatchObject({ configured: true, sent: 3, skipped: 1 });
    expect(await processCreatorEmails()).toEqual({ configured: true, sent: 0 });
    const sent = fetchMock.mock.calls.slice(1).map((_, i) => payload(fetchMock, i + 1));
    expect(sent.map((p) => `${p.to[0]} ${p.subject}`).sort()).toEqual([
      "nopay@example.com Connect a payment method to start receiving support",
      "payer@example.com Your README badge is ready to share",
      "signup@example.com Connect a payment method to start receiving support",
    ]);
    expect((await query("SELECT user_id FROM creator_email_deliveries WHERE template = ? ORDER BY user_id", [WELCOME_TEMPLATE])).rows)
      .toEqual([{ user_id: "signup" }]);
    expect((await getCreatorEmailRecipient("late"))?.reminderCompletedAt).toBe(due);
  });

  it("keeps Mailjet tracking IDs within its 64-character limit for real-length user IDs", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "mailjet"); vi.stubEnv("MAILJET_API_KEY", "test-public"); vi.stubEnv("MAILJET_SECRET_KEY", "test-private");
    const fetchMock = provider(); fetchMock.mockImplementation(async () => Response.json({ Messages: [{ Status: "success", To: [{ MessageUUID: "long-id" }] }] }));
    const { deliverEmail } = await import("../src/lib/email");
    const key = "creator-welcome-v2-test-welcome-" + "x".repeat(40);
    for (let i = 0; i < 2; i++) await deliverEmail({ to: "maker@example.com", subject: "Test", html: "Test", text: "Test", idempotencyKey: key });
    expect(payload(fetchMock).Messages[0].CustomID).toHaveLength(64);
    expect(payload(fetchMock).Messages[0].CustomID).toBe(payload(fetchMock, 1).Messages[0].CustomID);
  });
});
