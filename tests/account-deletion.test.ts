import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// "Delete my account" removes the page, payment settings, keys and everything linked to the person.

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  userId: "maker",
  revalidatePath: vi.fn(),
  deletedCookies: [] as string[],
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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: (name: string) => mocks.deletedCookies.push(name) }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../src/lib/session", async () => {
  const users = await import("../src/lib/users");
  return {
    SESSION_COOKIE: "bmt_session",
    getCurrentUser: async () => users.getUserById(mocks.userId),
    requireCreator: async () => {
      const user = await users.getUserById(mocks.userId);
      if (!user?.username) throw Object.assign(new Error("REDIRECT /login"), { url: "/login" });
      return user;
    },
  };
});

import { SCHEMA, query } from "../src/lib/db";
import { deleteAccountAction } from "../src/app/dashboard/account/actions";
import { matchesConfirmation } from "../src/app/dashboard/account/confirm";
import { deleteAccount, deletionPreview } from "../src/lib/account-deletion";
import { homePathFor } from "../src/lib/access";
import { TERMS_VERSION } from "../src/lib/legal/config";
import { getUserByUsername, upsertAuthUser } from "../src/lib/users";

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);
const GITHUB_ID = "github:4242";
const EMAIL = "maker.person@example.com";

async function seed() {
  await query(
    `INSERT INTO users (id, auth_id, login, email, username, display_name, bio, avatar_url, stripe_key_enc, stripe_mode,
                        usdc_address, paypal_email, project_url, socials, created_at, terms_version, terms_accepted_at, age_confirmed_at)
     VALUES ('maker', ?, 'MakerPerson', ?, 'maker', 'Maker Person', 'My bio', 'https://avatars.example/1', 'enc.key.data', 'live',
             '0x1111111111111111111111111111111111111111', 'pay@example.com', 'https://github.com/maker/tool', '{"x":"https://x.com/maker"}',
             ?, ?, ?, ?)`,
    [GITHUB_ID, EMAIL, NOW, TERMS_VERSION, NOW, NOW],
  );
  await query("INSERT INTO users (id, auth_id, login, username, display_name, created_at) VALUES ('friend', 'github:7', 'friend', 'friend', 'Friend', ?)", [NOW]);
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, supporter_name, message, status, created_at, paid_at, reply, tx_hash)
     VALUES ('d1', 'maker', 'live', 'usdc', 1, 500, 'Ada', 'Love it', 'paid', ?, ?, 'Thanks Ada', '0xabc'),
            ('d2', 'maker', 'live', 'stripe', 1, 500, '', '', 'pending', ?, NULL, NULL, NULL),
            ('f1', 'friend', 'live', 'stripe', 1, 500, 'Bob', 'Hi', 'paid', ?, ?, NULL, NULL)`,
    [NOW, NOW, NOW, NOW, NOW],
  );
  await query(
    `INSERT INTO applications (id, user_id, github_login, email, project_name, project_url, description, country, status, created_at, updated_at)
     VALUES ('a-own', 'maker', 'makerperson', ?, 'Tool', 'https://github.com/maker/tool', 'desc', 'TR', 'approved', ?, ?),
            ('a-guest', NULL, 'makerperson-old', 'MAKER.PERSON@example.com', 'Old', 'https://x', 'old', 'TR', 'pending', ?, ?),
            ('a-friend', 'friend', 'friend', 'friend@example.com', 'F', 'https://y', 'f', 'DE', 'pending', ?, ?)`,
    [EMAIL, NOW, NOW, NOW, NOW, NOW, NOW],
  );
  await query("UPDATE applications SET referred_by = 'maker' WHERE id = 'a-friend'");
  await query("INSERT INTO waitlist (id, email, referred_by, created_at) VALUES ('w1', ?, NULL, ?), ('w2', 'someone@example.com', 'maker', ?)", [
    EMAIL,
    NOW,
    NOW,
  ]);
  await query("INSERT INTO badge_copy_stats (user_id, style, copy_count, first_copied_at, last_copied_at) VALUES ('maker', 'button', 3, 1, 2)");
  await query("INSERT INTO creator_email_flows (user_id, registered_at, reminder_due_at) VALUES ('maker', 1, 2)");
  await query("INSERT INTO creator_email_deliveries (user_id, template, status, attempted_at) VALUES ('maker', 'creator-welcome-v2', 'sent', 1)");
}

/** Every text value in every table, to search for traces of the person. */
async function allText(): Promise<string> {
  const tables = await mocks.db.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  const dumps: string[] = [];
  for (const { table_name } of tables.rows) {
    const rows = await mocks.db.query(`SELECT * FROM ${table_name}`);
    dumps.push(`${table_name}: ${JSON.stringify(rows.rows)}`);
  }
  // Random ids are hex, so one can contain "ada" or "4242" by chance. They don't point back to anyone; leave them out.
  return dumps.join("\n").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>");
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users, account_deletions, waitlist, applications CASCADE");
  mocks.userId = "maker";
  mocks.deletedCookies = [];
  mocks.revalidatePath.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  await seed();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => mocks.db.close());

describe("delete my account", () => {
  it("needs the GitHub username typed to confirm", async () => {
    expect(matchesConfirmation(" @makerperson ", "MakerPerson")).toBe(true);
    expect(matchesConfirmation("maker", "MakerPerson")).toBe(false);
    expect(matchesConfirmation("", "")).toBe(false);

    const wrong = new FormData();
    wrong.set("confirm", "maker");
    expect(await deleteAccountAction({}, wrong)).toEqual({ error: "Type MakerPerson to confirm. Nothing was deleted." });
    expect(await getUserByUsername("maker")).not.toBeNull();
  });

  it("removes the page, payment details, keys and linked personal data, then signs the creator out", async () => {
    const preview = await deletionPreview("maker");
    expect(preview).toMatchObject({ supportRows: 2, applications: 2, waitlist: 1, hasStripeKey: true, hasPaypal: true, hasWallet: true });

    const confirm = new FormData();
    confirm.set("confirm", "makerperson");
    await expect(deleteAccountAction({}, confirm)).rejects.toMatchObject({ url: "/login?deleted=1" });
    expect(mocks.deletedCookies).toEqual(["bmt_session"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/maker");

    // The public page is gone: /maker renders notFound().
    expect(await getUserByUsername("maker")).toBeNull();
    const { default: CreatorPage } = await import("../src/app/[username]/page");
    await expect(
      CreatorPage({ params: Promise.resolve({ username: "maker" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NOT_FOUND");

    // Searching the whole database for the person finds nothing.
    const dump = await allText();
    for (const trace of [GITHUB_ID, "4242", "MakerPerson", "makerperson", EMAIL, "maker.person", "enc.key.data", "pay@example.com", "0x1111", "Ada", "Love it", "Thanks Ada", "My bio"]) {
      expect(dump.toLowerCase()).not.toContain(trace.toLowerCase());
    }

    // Other people's data stays; their link to the deleted creator is cleared.
    expect((await mocks.db.query("SELECT id, referred_by FROM applications ORDER BY id")).rows).toEqual([{ id: "a-friend", referred_by: null }]);
    expect((await mocks.db.query("SELECT id, referred_by FROM waitlist")).rows).toEqual([{ id: "w2", referred_by: null }]);
    expect((await mocks.db.query("SELECT id FROM donations")).rows).toEqual([{ id: "f1" }]);

    // One record of when, with nothing that points back to the person.
    const records = (await mocks.db.query<Record<string, unknown>>("SELECT * FROM account_deletions")).rows;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ source: "self_service" });
    expect(Number(records[0].requested_at)).toBe(NOW);
    expect(Number(records[0].completed_at)).toBe(NOW);
    expect(Number(records[0].remove_by)).toBe(NOW + 30 * 86_400_000);
  });

  it("means signing in again starts a new registration", async () => {
    await deleteAccount("maker", "email_request");
    expect(await deleteAccount("maker", "email_request")).toBe(false); // already gone
    const back = await upsertAuthUser({ authId: GITHUB_ID, login: "MakerPerson", email: EMAIL, name: "Maker", avatarUrl: null });
    expect(back.newlyCreated).toBe(true);
    expect(back).toMatchObject({ username: null, stripeKeyEnc: null, termsAcceptedAt: null });
    expect(homePathFor(back)).toBe("/onboarding");
  });
});
