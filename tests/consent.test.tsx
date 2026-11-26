import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A page can't be created without both boxes; existing creators accept in a blocking dialog;
// a new TERMS_VERSION asks again.

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  userId: "maker",
  pathname: "/dashboard",
  revalidatePath: vi.fn(),
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
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  },
  usePathname: () => mocks.pathname,
}));
vi.mock("../src/lib/session", async () => {
  const users = await import("../src/lib/users");
  const go = (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  };
  const requireUser = async () => (await users.getUserById(mocks.userId)) ?? go("/login");
  return {
    requireUser,
    getCurrentUser: async () => users.getUserById(mocks.userId),
    requireCreator: async () => {
      const user = await requireUser();
      return user.username ? user : go("/onboarding");
    },
  };
});

import { SCHEMA, query } from "../src/lib/db";
import { acceptTermsAction } from "../src/app/actions/consent";
import { updateProfileAction, saveUsdcAddressAction } from "../src/app/dashboard/actions";
import { likeSupportAction } from "../src/app/dashboard/support-actions";
import { claimUsernameAction } from "../src/app/onboarding/actions";
import { ConsentFields } from "../src/components/consent-fields";
import { ConsentGate } from "../src/components/consent-gate";
import { creatorsWithoutConsent } from "../src/lib/creator-activity";
import { hasCurrentConsent, needsConsent } from "../src/lib/consent";
import { TERMS_VERSION } from "../src/lib/legal/config";
import { getUserById } from "../src/lib/users";

const NOW = Date.UTC(2026, 10, 25, 9, 30, 0);

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function run<T>(action: () => Promise<T>): Promise<{ redirect: string } | { state: T }> {
  try {
    return { state: await action() };
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

async function signup(id = "maker") {
  await query("INSERT INTO users (id, auth_id, login, display_name, created_at) VALUES (?, ?, ?, ?, ?)", [
    id,
    `github:${id}`,
    id,
    "Maker",
    NOW,
  ]);
  mocks.userId = id;
}

/** A creator whose page existed before the Terms (nothing stored). */
async function existingCreator(id = "old", version: string | null = null) {
  await query(
    `INSERT INTO users (id, auth_id, login, username, display_name, created_at, setup_done_at, terms_version, terms_accepted_at, age_confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [id, `github:${id}`, id, id, id, NOW, version, version ? 1 : null, version ? 1 : null],
  );
  mocks.userId = id;
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  mocks.revalidatePath.mockReset();
  mocks.pathname = "/dashboard";
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => mocks.db.close());

describe("new creator registration", () => {
  it("can't create the page without both boxes ticked", async () => {
    await signup();
    const variants: Record<string, string>[] = [{}, { acceptTerms: "on" }, { confirmAge: "on" }];
    for (const boxes of variants) {
      expect(await run(() => claimUsernameAction({}, form({ username: "maker", displayName: "Maker", ...boxes })))).toEqual({
        state: { error: "Please tick both boxes to continue." },
      });
    }
    expect((await getUserById("maker"))?.username).toBeNull();
  });

  it("stores the acceptance time, version and age confirmation with the page, and no IP address", async () => {
    await signup();
    expect(
      await run(() => claimUsernameAction({}, form({ username: "maker", displayName: "Maker", acceptTerms: "on", confirmAge: "on" }))),
    ).toEqual({ redirect: "/onboarding/payments" });

    const { rows } = await mocks.db.query<{ terms_accepted_at: string; terms_version: string; age_confirmed_at: string; at: string }>(
      `SELECT terms_accepted_at, terms_version, age_confirmed_at,
              to_char(to_timestamp(terms_accepted_at / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at
       FROM users WHERE id = 'maker'`,
    );
    const row = rows[0];
    expect([Number(row.terms_accepted_at), row.terms_version, Number(row.age_confirmed_at), row.at]).toEqual([
      NOW,
      TERMS_VERSION,
      NOW,
      "2026-11-25T09:30:00Z",
    ]);
    const columns = await mocks.db.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'",
    );
    expect(columns.rows.map((c) => c.column_name).filter((c) => /(^|_)ip(_|$)|address_ip|remote_addr/i.test(c))).toEqual([]);
    expect(hasCurrentConsent((await getUserById("maker"))!)).toBe(true);
  });
});

describe("existing creators", () => {
  it("see the blocking dialog until they accept, and can't change their page meanwhile", async () => {
    await existingCreator();
    const user = (await getUserById("old"))!;
    expect(needsConsent(user)).toBe(true);
    expect(await creatorsWithoutConsent(TERMS_VERSION)).toBe(1);

    expect(await run(() => updateProfileAction({}, form({ displayName: "Changed", bio: "", price: "5" })))).toEqual({
      redirect: "/dashboard",
    });
    expect(
      await run(() => saveUsdcAddressAction({}, form({ address: "0x1111111111111111111111111111111111111111" }))),
    ).toEqual({ redirect: "/dashboard" });
    expect(await likeSupportAction("any", true)).toEqual({ ok: false, error: "Please accept the updated Terms in your dashboard first." });
    expect((await getUserById("old"))?.displayName).toBe("old");

    expect(await acceptTermsAction({}, form({ acceptTerms: "on" }))).toEqual({ error: "Please tick both boxes to continue." });
    expect(await acceptTermsAction({}, form({ acceptTerms: "on", confirmAge: "on" }))).toEqual({
      message: "Thank you. You're all set.",
    });
    const accepted = (await getUserById("old"))!;
    expect(accepted).toMatchObject({ termsVersion: TERMS_VERSION, termsAcceptedAt: NOW, ageConfirmedAt: NOW });
    expect(needsConsent(accepted)).toBe(false);
    expect(await creatorsWithoutConsent(TERMS_VERSION)).toBe(0);
    expect(await run(() => updateProfileAction({}, form({ displayName: "Changed", bio: "", price: "5" })))).toEqual({
      state: { message: "Saved. Your page is updated." },
    });
  });

  it("are asked again when TERMS_VERSION changes", async () => {
    await existingCreator("previous", "2026-01-01-draft");
    expect(needsConsent((await getUserById("previous"))!)).toBe(true);
    expect(await creatorsWithoutConsent(TERMS_VERSION)).toBe(1);
    await existingCreator("current", TERMS_VERSION);
    expect(needsConsent((await getUserById("current"))!)).toBe(false);
    // Bumping the version in the config makes everyone on the old one see the dialog again.
    expect(await creatorsWithoutConsent("2027-01-01")).toBe(2);
  });

  it("people without a page tick the boxes while claiming it instead of in the dialog", async () => {
    await signup();
    expect(needsConsent((await getUserById("maker"))!)).toBe(false);
  });
});

describe("dialog", () => {
  it("blocks the page behind it with two unticked boxes and new-tab links", () => {
    const html = renderToStaticMarkup(
      <ConsentGate required className="page">
        <p>Dashboard</p>
      </ConsentGate>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/<div class="page" inert=""[^>]*aria-hidden="true"><p>Dashboard<\/p><\/div>/);
    const boxes = html.match(/<input type="checkbox"[^>]*>/g) ?? [];
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).toContain("required");
      expect(box).not.toMatch(/checked=""/);
    }
    expect(html).toMatch(/<a href="\/terms" target="_blank" rel="noopener noreferrer"[^>]*>Terms of Service<\/a>/);
    expect(html).toMatch(/<a href="\/privacy" target="_blank" rel="noopener noreferrer"[^>]*>Privacy Policy<\/a>/);
    expect(html).toContain("I am at least 18 years old.");
  });

  it("is absent once accepted, and the account page stays reachable for deleting the account", () => {
    expect(renderToStaticMarkup(<ConsentGate required={false}>x</ConsentGate>)).not.toContain('role="dialog"');
    mocks.pathname = "/dashboard/account";
    expect(renderToStaticMarkup(<ConsentGate required>x</ConsentGate>)).not.toContain('role="dialog"');
  });

  it("uses the same two boxes as registration", () => {
    const html = renderToStaticMarkup(<ConsentFields />);
    expect(html.match(/name="acceptTerms"/g)).toHaveLength(1);
    expect(html.match(/name="confirmAge"/g)).toHaveLength(1);
  });
});
