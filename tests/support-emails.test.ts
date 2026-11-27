import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  deliver: vi.fn(),
  live: true,
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

vi.mock("../src/lib/email", () => ({
  deliverEmail: mocks.deliver,
  emailConfigured: () => true,
  liveEmailEnabled: () => mocks.live,
  testEmailRecipient: () => "ops@example.com",
}));

import { SCHEMA, query } from "../src/lib/db";
import { setSupportEmails } from "../src/lib/users";
import {
  BATCH_MS,
  SUPPORT_LEDGER,
  cleanName,
  processSupportEmails,
  sendSupportEmail,
  supportEmail,
} from "../src/lib/support-emails";

const MIN = 60_000;
let ledgerAt = 0;
let seq = 0;

async function creator(id = "maker", email: string | null = "maker@example.com") {
  await query(
    `INSERT INTO users (id, auth_id, login, email, username, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, `github:${id}`, id, email, id, "Ada Lovelace", ledgerAt - 86_400_000],
  );
}

async function paid(input: { creatorId?: string; at: number; name?: string; message?: string; cents?: number; mode?: string; method?: string; status?: string }) {
  const id = `don-${++seq}`;
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, supporter_name, message, status, created_at, paid_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.creatorId ?? "maker", input.mode ?? "live", input.method ?? "paypal", (input.cents ?? 1500) / 500,
      input.cents ?? 1500, input.name ?? "Grace", input.message ?? "", input.status ?? "paid", input.at - MIN, input.at],
  );
  return id;
}

async function notes() {
  const { rows } = await query("SELECT donation_id, status, attempt_count FROM support_notifications ORDER BY donation_id");
  return rows as { donation_id: string; status: string; attempt_count: number }[];
}

describe("support emails", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
    const { rows } = await query("SELECT applied_at FROM schema_migrations WHERE id = ?", [SUPPORT_LEDGER]);
    ledgerAt = Number(rows[0].applied_at);
  });

  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE; TRUNCATE ops_events");
    await creator();
    mocks.live = true;
    mocks.deliver.mockReset();
    mocks.deliver.mockResolvedValue({ status: "accepted", id: "msg-1" });
  });

  afterAll(async () => {
    await mocks.db.close();
  });

  it("announces a confirmed payment once, to the creator", async () => {
    const at = ledgerAt + MIN;
    const id = await paid({ at, name: "Grace", message: "Love the CLI!" });

    expect(await processSupportEmails(at + MIN)).toMatchObject({ sent: 1 });
    expect(await processSupportEmails(at + 30 * MIN)).toMatchObject({ sent: 0 });

    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    const mail = mocks.deliver.mock.calls[0][0];
    expect(mail.to).toBe("maker@example.com");
    expect(mail.subject).toBe("Grace bought you 3M tokens");
    expect(mail.text).toContain("Hi Ada,");
    expect(mail.text).toContain("Grace supported your page with $15 via PayPal.");
    expect(mail.text).toContain('"Love the CLI!"');
    expect(mail.html).toContain("/dashboard#recent-support");
    expect(await notes()).toEqual([{ donation_id: id, status: "sent", attempt_count: 1 }]);
  });

  it("never announces payments from before the feature shipped", async () => {
    await paid({ at: ledgerAt - MIN });

    expect(await processSupportEmails(ledgerAt + MIN)).toMatchObject({ sent: 0 });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("doesn't announce support that was refunded before the email went out", async () => {
    await paid({ at: ledgerAt + MIN, status: "failed" });

    expect(await processSupportEmails(ledgerAt + 2 * MIN)).toMatchObject({ sent: 0 });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("bundles payments and sends at most one email per creator in the batch window", async () => {
    const at = ledgerAt + MIN;
    await paid({ at, name: "Grace", cents: 500 });
    await paid({ at: at + 1000, name: "Linus", cents: 1000 });

    await processSupportEmails(at + MIN);
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(mocks.deliver.mock.calls[0][0].subject).toBe("2 supporters bought you 3M tokens");
    expect(mocks.deliver.mock.calls[0][0].text).toContain("2 people supported your page, $15 in all.");

    // A third payment two minutes later waits for the window to pass, then goes out alone.
    await paid({ at: at + 2 * MIN, name: "Margaret" });
    await processSupportEmails(at + 3 * MIN);
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    await processSupportEmails(at + MIN + BATCH_MS + 1000);
    expect(mocks.deliver).toHaveBeenCalledTimes(2);
    expect(mocks.deliver.mock.calls[1][0].subject).toBe("Margaret bought you 3M tokens");
  });

  it("lists five supporters by name and counts the rest", async () => {
    const at = ledgerAt + MIN;
    for (let i = 0; i < 7; i++) await paid({ at: at + i, name: `Fan ${i}` });

    await processSupportEmails(at + MIN);
    const mail = mocks.deliver.mock.calls[0][0];
    expect(mail.subject).toBe("7 supporters bought you 21M tokens");
    expect(mail.text).toContain("Fan 4");
    expect(mail.text).not.toContain("Fan 5");
    expect(mail.text).toContain("and 2 more on your dashboard");
  });

  it("skips creators who turned the emails off, and doesn't announce that support later", async () => {
    await setSupportEmails("maker", false);
    const at = ledgerAt + MIN;
    await paid({ at });

    expect(await processSupportEmails(at + MIN)).toMatchObject({ sent: 0, skipped: 1 });
    await setSupportEmails("maker", true);
    expect(await processSupportEmails(at + 30 * MIN)).toMatchObject({ sent: 0 });
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect((await notes())[0].status).toBe("skipped");
  });

  it("skips creators without an email address", async () => {
    await creator("noemail", null);
    await paid({ creatorId: "noemail", at: ledgerAt + MIN });

    expect(await processSupportEmails(ledgerAt + 2 * MIN)).toMatchObject({ sent: 0, skipped: 1 });
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("retries a rejected send up to three times, five minutes apart, and reports it", async () => {
    mocks.deliver.mockResolvedValue({ status: "rejected" });
    const at = ledgerAt + MIN;
    await paid({ at });

    await processSupportEmails(at + MIN);
    await processSupportEmails(at + 2 * MIN); // too soon to retry
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    await processSupportEmails(at + 7 * MIN);
    await processSupportEmails(at + 13 * MIN);
    await processSupportEmails(at + 19 * MIN); // no fourth attempt
    expect(mocks.deliver).toHaveBeenCalledTimes(3);
    expect((await notes())[0]).toMatchObject({ status: "failed", attempt_count: 3 });

    const { rows } = await query("SELECT tag, count FROM ops_events");
    expect(rows).toEqual([{ tag: "[email] support email not sent", count: 3 }]);
  });

  it("never resends after an ambiguous outcome", async () => {
    mocks.deliver.mockResolvedValue({ status: "unknown" });
    const at = ledgerAt + MIN;
    await paid({ at });

    await processSupportEmails(at + MIN);
    await processSupportEmails(at + 60 * MIN);
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect((await notes())[0].status).toBe("unknown");
  });

  it("can't announce a payment twice when two workers overlap", async () => {
    const at = ledgerAt + MIN;
    await paid({ at });
    let release!: () => void;
    mocks.deliver.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ status: "accepted", id: "x" });
    }));

    const first = sendSupportEmail("maker", at + MIN);
    await vi.waitFor(() => expect(mocks.deliver).toHaveBeenCalledTimes(1));
    expect(await sendSupportEmail("maker", at + MIN)).toBe("none");
    release();
    expect(await first).toBe("sent");
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
  });

  it("sends nothing while live email is off", async () => {
    mocks.live = false;
    await paid({ at: ledgerAt + MIN });

    expect(await processSupportEmails(ledgerAt + 2 * MIN)).toMatchObject({ testMode: true });
    expect(await notes()).toEqual([]);
  });

  it("labels test-mode payments", async () => {
    await paid({ at: ledgerAt + MIN, mode: "test", method: "stripe" });

    await processSupportEmails(ledgerAt + 2 * MIN);
    const mail = mocks.deliver.mock.calls[0][0];
    expect(mail.subject).toBe("[Test] Grace bought you 3M tokens");
    expect(mail.text).toContain("This was a test-mode payment, so no real money moved.");
    expect(mail.text).toContain("via card");
  });
});

describe("support email content", () => {
  const item = { id: "d", amountCents: 500, units: 1, method: "usdc", test: false, paidAt: 0 };

  it("escapes what supporters typed", () => {
    const { html, subject } = supportEmail({ displayName: "Ada", username: "ada" }, [
      { ...item, supporterName: '<img src=x onerror=alert(1)>', message: "<script>alert(1)</script> & thanks" },
    ]);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; thanks");
    expect(subject).toBe("<img src=x onerror=alert(1)> bought you 1M tokens");
  });

  it("keeps the subject to one short line", () => {
    expect(cleanName("Grace\r\nBcc: someone@example.com")).toBe("Grace Bcc: someone@example.com");
    expect(cleanName("x".repeat(80))).toHaveLength(40);
    expect(cleanName("   ")).toBe("");
    const { subject } = supportEmail({ displayName: "", username: "ada" }, [{ ...item, supporterName: "", message: "" }]);
    expect(subject).toBe("Someone bought you 1M tokens");
  });

  it("names the payment method and has one link", () => {
    const { html, text } = supportEmail({ displayName: "Ada", username: "ada" }, [{ ...item, supporterName: "Grace", message: "" }]);
    expect(text).toContain("via USDC on Base");
    expect(html.match(/<a\s/g)).toHaveLength(1);
  });
});
