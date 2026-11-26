import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Payment secrets stay encrypted, and never reach the browser, error messages or logs.

process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.APP_URL = "https://buymeatokens.test";

// Fake keys, assembled at runtime so secret scanners and push protection don't mistake them for real ones.
const LIVE_KEY = ["rk", "live", "51SecretRestrictedKeyThatMustNeverLeak9Zq7"].join("_");
const SECRET_KEY = ["sk", "live", "51FullSecretKeyThatMustBeRefusedAndNeverLogged"].join("_");

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  userId: "maker",
  logs: [] as string[],
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  },
}));
vi.mock("../src/lib/session", async () => {
  const users = await import("../src/lib/users");
  return {
    getCurrentUser: async () => users.getUserById(mocks.userId),
    requireCreator: async () => (await users.getUserById(mocks.userId))!,
  };
});

import { SCHEMA, query } from "../src/lib/db";
import { encrypt } from "../src/lib/crypto";
import { startCheckout } from "../src/app/[username]/actions";
import { saveStripeKeyAction } from "../src/app/dashboard/actions";
import { GET as exportCsv } from "../src/app/api/creators/[username]/payments.csv/route";
import { loadCreatorPage } from "../src/lib/creator-page-data";
import { storedStripeKeyLast4 } from "../src/lib/payment-secrets";
import { SECRET_PREFIX_RE, describeForLog, logError, redactSecrets } from "../src/lib/redact";
import { StripeApiError } from "../src/lib/stripe";
import { TERMS_VERSION } from "../src/lib/legal/config";
import { getUserById } from "../src/lib/users";

const ROOT = join(__dirname, "..");

function stripeReplies(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  mocks.logs = [];
  // Capture everything the code logs, as the hosting provider would.
  for (const level of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      mocks.logs.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    });
  }
  await query(
    `INSERT INTO users (id, auth_id, login, username, display_name, created_at, stripe_key_enc, stripe_mode,
                        terms_version, terms_accepted_at, age_confirmed_at)
     VALUES ('maker', 'github:1', 'maker', 'maker', 'Maker', 1, ?, 'live', ?, 1, 1)`,
    [encrypt(LIVE_KEY), TERMS_VERSION],
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(async () => mocks.db.close());

describe("redaction", () => {
  it("blanks out anything shaped like a key or token", () => {
    expect(redactSecrets(`Invalid API Key provided: ${LIVE_KEY}.`)).toBe("Invalid API Key provided: [redacted].");
    expect(redactSecrets(`${SECRET_KEY} whsec_abcdef123 ghp_${"a".repeat(36)} Bearer abc.def.ghijklmnop`)).toBe(
      "[redacted] [redacted] [redacted] [redacted]",
    );
    expect(redactSecrets("cs_live_a1b2c3 and 0xabc stay")).toBe("cs_live_a1b2c3 and 0xabc stay");
    expect(new StripeApiError(`No such key ${LIVE_KEY}`, 401).message).toBe("No such key [redacted]");
    expect(describeForLog(new Error(`boom ${SECRET_KEY}`))).toBe("Error: boom [redacted]");
  });
});

describe("Stripe keys", () => {
  it("are stored encrypted, and the interface only ever gets the last four characters", async () => {
    const user = (await getUserById("maker"))!;
    expect(user.stripeKeyEnc).not.toContain(LIVE_KEY);
    expect(user.stripeKeyEnc).not.toMatch(SECRET_PREFIX_RE);
    expect(storedStripeKeyLast4(user.stripeKeyEnc)).toBe("9Zq7");
    expect(storedStripeKeyLast4("not-a-valid-payload")).toBeNull();
  });

  it("refuses full secret keys with a clear message, without storing or logging them", async () => {
    vi.stubGlobal("fetch", stripeReplies(200, {}));
    const result = await saveStripeKeyAction({}, form({ key: SECRET_KEY }));
    expect(result.error).toMatch(/^That's a secret key\..*restricted key \(starts with rk_\)/);
    expect(JSON.stringify(result)).not.toContain(SECRET_KEY);
    expect(fetch).not.toHaveBeenCalled();
    expect((await getUserById("maker"))!.stripeKeyEnc).not.toBe(null);
    expect(mocks.logs.join("\n")).not.toMatch(SECRET_PREFIX_RE);
  });

  it("never echo a key back in an error message, even if Stripe did", async () => {
    vi.stubGlobal("fetch", stripeReplies(400, { error: { message: `Bad request for key ${LIVE_KEY}` } }));
    const result = await saveStripeKeyAction({}, form({ key: LIVE_KEY }));
    expect(result.error).toBe("Stripe rejected the key: Bad request for key [redacted]");
    expect(mocks.logs.join("\n")).not.toMatch(SECRET_PREFIX_RE);
  });

  it("stay out of the logs when checkout fails", async () => {
    vi.stubGlobal("fetch", stripeReplies(500, { error: { message: `Internal error using ${LIVE_KEY}` } }));
    await expect(startCheckout(form({ username: "maker", units: "2", name: "Ada", message: "hi" }))).rejects.toMatchObject({
      url: "/maker?error=checkout",
    });
    const logs = mocks.logs.join("\n");
    expect(logs).toContain("[checkout]");
    expect(logs).not.toContain(LIVE_KEY);
    expect(logs).not.toMatch(SECRET_PREFIX_RE);
  });

  it("are not in anything sent to the browser: the public page data and the CSV export", async () => {
    const user = (await getUserById("maker"))!;
    const page = JSON.stringify(await loadCreatorPage(user));
    expect(page).not.toContain(user.stripeKeyEnc!);
    expect(page).not.toMatch(SECRET_PREFIX_RE);
    expect(page).toContain('"cardEnabled":true');

    const csv = await (await exportCsv(new Request("http://x"), { params: Promise.resolve({ username: "maker" }) })).text();
    expect(csv).not.toContain(user.stripeKeyEnc!);
    expect(csv).not.toMatch(SECRET_PREFIX_RE);
  });

  it("logError writes redacted lines", () => {
    logError("[test]", new Error(`failed with ${LIVE_KEY}`), { header: `Bearer ${SECRET_KEY}` });
    expect(mocks.logs.at(-1)).toBe('[test] Error: failed with [redacted] {"header":"Bearer [redacted]"}');
  });
});

describe("grep check", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sources(path) : /\.(tsx?|mjs)$/.test(path) ? [path] : [];
    });
  }

  it("no source file contains a real-looking key, and no log call is handed a key or secret variable", () => {
    const offenders: string[] = [];
    for (const file of [...sources(join(ROOT, "src")), ...sources(join(ROOT, "scripts"))]) {
      const source = readFileSync(file, "utf8");
      if (SECRET_PREFIX_RE.test(source)) offenders.push(`${relative(ROOT, file)}: key-like literal`);
      for (const call of source.match(/console\.(?:log|info|warn|error)\([^;]*\)/g) ?? []) {
        if (/\b(key|secret|token|password|stripeKeyEnc|accessToken|decrypt)\b/i.test(call)) {
          offenders.push(`${relative(ROOT, file)}: ${call.slice(0, 120)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
