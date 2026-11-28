import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  user: null as null | { id: string; username: string },
  oldTerms: false,
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
  usePathname: () => "/",
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("../src/lib/session", async () => {
  const { TERMS_VERSION } = await import("../src/lib/legal/config");
  return {
    requireCreator: async () => {
      if (!mocks.user) throw new Error("not signed in");
      return { ...mocks.user, termsVersion: mocks.oldTerms ? "2000-01-01" : TERMS_VERSION, termsAcceptedAt: 1, ageConfirmedAt: 1 };
    },
  };
});

import { setDirectoryAction } from "../src/app/dashboard/actions";
import { DirectoryView } from "../src/components/directory-view";
import { SiteFooter } from "../src/components/site-footer";
import { metadata as searchMetadata } from "../src/app/directory/search/page";
import sitemap from "../src/app/sitemap";
import { SCHEMA, query } from "../src/lib/db";
import { CATEGORIES, LANGUAGES, MAX_PAGE, PAGE_SIZE, languageFromGitHub, listDirectory, parseFilters, searchQuery } from "../src/lib/directory";

type Seed = Partial<{
  username: string; displayName: string; project: string | null; bio: string; listedAt: number | null; category: string | null;
  language: string | null; paypal: string | null; authId: string; email: string;
}>;
let seq = 0;

async function creator(s: Seed = {}) {
  const n = ++seq;
  const username = s.username ?? `maker${n}`;
  await query(
    `INSERT INTO users (id, auth_id, login, email, username, display_name, bio, project_name, paypal_email, listed_at,
       project_category, project_language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`id-${n}`, s.authId ?? `github:${n}`, username, s.email ?? `${username}@example.com`, username, s.displayName ?? `Maker ${n}`,
      s.bio ?? "A small tool.", s.project === undefined ? `Project ${n}` : s.project, s.paypal === undefined ? "pay@example.com" : s.paypal,
      s.listedAt === undefined ? 1_000 + n : s.listedAt, s.category ?? null, s.language ?? null, 1],
  );
  return `id-${n}`;
}
const names = async (input: Parameters<typeof listDirectory>[0]) => (await listDirectory(input)).entries.map((e) => e.username);

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
afterAll(() => mocks.db.close());
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  mocks.user = null;
  seq = 0;
});

describe("who is listed", () => {
  it("shows only opted-in, public creators with a project name or a bio", async () => {
    await creator({ username: "listed" });
    await creator({ username: "bioonly", project: null });
    await creator({ username: "optedout", listedAt: null });
    await creator({ username: "nopayment", paypal: null });
    await creator({ username: "devaccount", authId: "dev:x" });
    await creator({ username: "empty", project: " ", bio: "  " });
    expect((await names({})).sort()).toEqual(["bioonly", "listed"]);
  });

  it("lists dev-login accounts only where dev login is on, so the directory can be tried locally", async () => {
    await creator({ username: "devaccount", authId: "dev:x" });
    expect(await names({})).toEqual([]);
    vi.stubEnv("DEV_LOGIN", "true");
    try {
      expect(await names({})).toEqual(["devaccount"]);
      // A production build never has dev login, whatever DEV_LOGIN says.
      vi.stubEnv("NODE_ENV", "production");
      expect(await names({})).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("applying the schema twice changes nothing", async () => {
    await mocks.db.exec(SCHEMA);
    await creator({ username: "again" });
    expect(await names({})).toEqual(["again"]);
  });
});

describe("search", () => {
  beforeEach(async () => {
    await creator({ username: "alpha", displayName: "Ada Lovelace", project: "Engine", bio: "Computes things" });
    await creator({ username: "beta", displayName: "Bob", project: "Zebra", bio: "Mentions engine in passing" });
  });

  it("matches project name, display name, username and bio, ignoring case", async () => {
    expect((await names({ q: "ENGINE" })).sort()).toEqual(["alpha", "beta"]);
    expect(await names({ q: "lovelace" })).toEqual(["alpha"]);
    expect(await names({ q: "BETA" })).toEqual(["beta"]);
    expect(await names({ q: "computes" })).toEqual(["alpha"]);
  });

  it("puts name matches before bio matches, then the newest listing", async () => {
    await creator({ username: "gamma", project: "Other", bio: "engine again", listedAt: 9_000 });
    // alpha matches by project name; gamma (newer) and beta only by bio.
    expect(await names({ q: "engine" })).toEqual(["alpha", "gamma", "beta"]);
  });

  it("matches words by their start, and nothing the user types is query syntax", async () => {
    await creator({ username: "pct", project: "100% done", bio: "x" });
    await creator({ username: "kit", project: "Toolkit for agents", bio: "x" });
    await creator({ username: "quote", project: "it's \"fine\"", bio: "x" });
    await creator({ username: "slash", project: "c:\\tmp", bio: "x" });
    expect(await names({ q: "100% done" })).toEqual(["pct"]);
    expect(await names({ q: "tool agen" })).toEqual(["kit"]);
    expect(await names({ q: "kit" })).toEqual(["kit"]); // the username
    expect(await names({ q: "olkit" })).toEqual([]); // a word's start, not its middle
    expect(await names({ q: "fine" })).toEqual(["quote"]);
    expect(await names({ q: "c:\\tmp" })).toEqual(["slash"]);
    // No word in it: nothing, not everything.
    for (const q of ["%%", "__", "\\\\", "&|!:*()"]) expect(await names({ q })).toEqual([]);
    // tsquery operators and SQL are just words to look for.
    expect(await names({ q: "'; DROP TABLE users; --" })).toEqual([]);
    expect(await names({ q: "fine & !x | (y)" })).toEqual([]);
    expect(searchQuery("Tool  KIT!")).toBe("tool:* & kit:*");
    expect(searchQuery("a b c d e f g h")).toBe("a:* & b:* & c:* & d:* & e:* & f:*");
  });

  it("serves a search from the partial full-text index", async () => {
    const { rows } = await mocks.db.query<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE indexname = 'users_directory_search'");
    expect(rows[0]?.indexdef).toContain("USING gin");
    expect(rows[0]?.indexdef).toContain("WHERE (listed_at IS NOT NULL)");
  });

  it("leaves out a page in Stripe test mode", async () => {
    await creator({ username: "tester", project: "Engine test", bio: "x" });
    await query("UPDATE users SET stripe_mode = 'test' WHERE username = 'tester'");
    expect(await names({ q: "engine" })).not.toContain("tester");
    expect(await names({})).not.toContain("tester");
  });

  it("ignores queries under two characters and caps long ones", async () => {
    expect(parseFilters({ q: "a" }).q).toBe("");
    expect(parseFilters({ q: " a " }).q).toBe("");
    expect(await names({ q: "z" })).toHaveLength(2);
    expect(parseFilters({ q: "x".repeat(500) }).q).toHaveLength(60);
  });
});

describe("filters", () => {
  it("filter by category and language, and drop values outside the lists", async () => {
    await creator({ username: "web", category: "Web", language: "Go" });
    await creator({ username: "ml", category: "AI & ML", language: "Python" });
    expect(await names({ category: "Web" })).toEqual(["web"]);
    expect(await names({ language: "Python" })).toEqual(["ml"]);
    expect(await names({ category: "Web", language: "Python" })).toEqual([]);
    expect(parseFilters({ category: "Nonsense", language: "Cobol" })).toMatchObject({ category: "", language: "" });
    expect(await names({ category: "Web' OR '1'='1" })).toHaveLength(2);
  });

  it("suggests a language from GitHub's name for it", () => {
    expect(languageFromGitHub("typescript")).toBe("TypeScript");
    expect(languageFromGitHub("Jupyter Notebook")).toBe("Other");
    expect(languageFromGitHub(null)).toBe("");
  });
});

describe("ordering and pages", () => {
  it("lists the most recently listed first and pages by 24 up to the cap", async () => {
    for (let i = 0; i < PAGE_SIZE + 1; i++) await creator({ username: `p${String(i).padStart(2, "0")}`, listedAt: 10_000 + i });
    const one = await listDirectory({});
    expect(one.entries).toHaveLength(PAGE_SIZE);
    expect(one.entries[0].username).toBe("p24");
    expect(one.hasNext).toBe(true);
    const two = await listDirectory({ page: "2" });
    expect(two.entries.map((e) => e.username)).toEqual(["p00"]);
    expect(two.hasNext).toBe(false);
    expect((await listDirectory({ page: "0" })).filters.page).toBe(1);
    expect((await listDirectory({ page: "-3" })).filters.page).toBe(1);
    expect(parseFilters({ page: "999" }).page).toBe(MAX_PAGE);
    expect((await listDirectory({ page: String(MAX_PAGE) })).hasNext).toBe(false);
  });
});

describe("opting in", () => {
  it("lists and unlists the signed-in creator and keeps the first listing time", async () => {
    const id = await creator({ listedAt: null });
    mocks.user = { id, username: "maker1" };
    expect(await setDirectoryAction({ listed: true, category: "Web", language: "Go" })).toEqual({ ok: true });
    const first = (await query("SELECT listed_at, project_category, project_language FROM users WHERE id = ?", [id])).rows[0];
    expect(Number(first.listed_at)).toBeGreaterThan(0);
    expect([first.project_category, first.project_language]).toEqual(["Web", "Go"]);
    await setDirectoryAction({ listed: true, category: "Data", language: "" });
    const again = (await query("SELECT listed_at, project_language FROM users WHERE id = ?", [id])).rows[0];
    expect(again.listed_at).toBe(first.listed_at);
    expect(again.project_language).toBeNull();
    await setDirectoryAction({ listed: false, category: "", language: "" });
    expect((await query("SELECT listed_at FROM users WHERE id = ?", [id])).rows[0].listed_at).toBeNull();
  });

  it("lets a creator leave without accepting new Terms, but not join", async () => {
    const id = await creator();
    mocks.user = { id, username: "maker1" };
    mocks.oldTerms = true;
    try {
      expect(await setDirectoryAction({ listed: false, category: "", language: "" })).toEqual({ ok: true });
      expect((await query("SELECT listed_at FROM users WHERE id = ?", [id])).rows[0].listed_at).toBeNull();
      await expect(setDirectoryAction({ listed: true, category: "", language: "" })).rejects.toThrow(/REDIRECT/);
      expect((await query("SELECT listed_at FROM users WHERE id = ?", [id])).rows[0].listed_at).toBeNull();
    } finally {
      mocks.oldTerms = false;
    }
  });

  it("refuses crafted values and anyone who is not a signed-in creator", async () => {
    const id = await creator({ listedAt: null });
    mocks.user = { id, username: "maker1" };
    for (const bad of [
      { listed: true, category: "Hacking", language: "" },
      { listed: true, category: "", language: "Cobol" },
      { listed: "yes", category: "", language: "" },
      { listed: true, category: ["Web"], language: "" },
      { listed: true, category: null, language: "" },
    ]) {
      expect(await setDirectoryAction(bad as never)).toEqual({ ok: false });
    }
    expect(await setDirectoryAction(null as never)).toEqual({ ok: false });
    expect((await query("SELECT listed_at FROM users WHERE id = ?", [id])).rows[0].listed_at).toBeNull();
    mocks.user = null;
    await expect(setDirectoryAction({ listed: true, category: "", language: "" })).rejects.toThrow();
    expect((await query("SELECT listed_at FROM users WHERE id = ?", [id])).rows[0].listed_at).toBeNull();
  });

  it("only ever changes the signed-in creator's own row", async () => {
    await creator({ listedAt: null });
    const other = await creator({ listedAt: null });
    mocks.user = { id: "id-1", username: "maker1" };
    await setDirectoryAction({ listed: true, category: "", language: "" });
    expect((await query("SELECT listed_at FROM users WHERE id = ?", [other])).rows[0].listed_at).toBeNull();
  });
});

describe("the page", () => {
  it("renders cards with public fields only, and the footer link", async () => {
    await creator({ username: "pub", displayName: "Pat", project: "Pat Tool", bio: "Does **things**.", category: "Web", language: "Go", email: "secret@example.com" });
    await query(
      "INSERT INTO donations (id, creator_id, stripe_mode, method, units, amount_cents, supporter_name, message, status, created_at, paid_at) VALUES ('d', 'id-1', 'live', 'paypal', 3, 1500, 'Zed', 'hi', 'paid', 1, 1)",
    );
    const html = renderToStaticMarkup(<DirectoryView result={await listDirectory({})} />) + renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain('href="/pub"');
    expect(html).toContain("Pat Tool");
    expect(html).toContain("Web");
    expect(html).toContain("Go");
    expect(html).not.toContain("secret@example.com");
    expect(html).not.toContain("pay@example.com");
    expect(html).not.toMatch(/\$\d|1500|15\.00|Zed/);
    expect(html).toContain('href="/directory"');
  });

  it("has an empty state for a launch and for a search without results", async () => {
    expect(renderToStaticMarkup(<DirectoryView result={await listDirectory({})} />)).toContain("No projects listed yet.");
    await creator();
    expect(renderToStaticMarkup(<DirectoryView result={await listDirectory({ q: "nothing-like-this" })} />)).toContain("No projects match.");
  });

  it("keeps searches out of search engines and the directory in the sitemap", async () => {
    expect(searchMetadata.robots).toMatchObject({ index: false });
    expect((await sitemap()).map((e) => e.url).some((u) => u.endsWith("/directory"))).toBe(true);
    expect(CATEGORIES).toContain("Other");
    expect(LANGUAGES).toContain("Other");
  });
});
