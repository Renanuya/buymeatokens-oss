import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
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

import { SCHEMA, query } from "../src/lib/db";
import { GET } from "../src/app/api/badge/[username]/route";
import { renderBadge } from "../src/lib/badge";

const NOW = Date.now();

async function creator(username = "maker") {
  await query(
    `INSERT INTO users (id, auth_id, login, username, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, `github:${username}`, username, username, "Maker", NOW],
  );
}

async function paidDonation(creatorId: string, units: number) {
  await query(
    `INSERT INTO donations (id, creator_id, stripe_mode, units, amount_cents, supporter_name, message, status, method, created_at)
     VALUES (?, ?, 'live', ?, ?, 'Ada', 'Thanks!', 'paid', 'stripe', ?)`,
    [`don-${units}`, creatorId, units, units * 500, NOW],
  );
}

async function setGoal(creatorId: string, goalUnits: number, startedAt: number) {
  await query(`UPDATE users SET goal_units = ?, goal_started_at = ? WHERE id = ?`, [
    goalUnits,
    startedAt,
    creatorId,
  ]);
}

async function getBadge(username: string, search = ""): Promise<Response> {
  return GET(new Request(`http://localhost/api/badge/${username}${search}`), {
    params: Promise.resolve({ username }),
  });
}

describe("GET /api/badge/[username]", () => {
  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });

  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE");
    await creator();
    await paidDonation("maker", 12);
  });

  afterAll(async () => {
    await mocks.db.close();
  });

  it("returns a valid SVG with no count for an unknown username", async () => {
    const res = await getBadge("ghost");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=600");
    const svg = await res.text();
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<title>Buy me AI tokens</title>");
    expect(svg).not.toContain("<title>Buy me AI tokens: ");
  });

  it("shows the token count for a creator with paid support", async () => {
    const res = await getBadge("maker");

    expect(res.status).toBe(200);
    const svg = await res.text();
    expect(svg).toContain("<title>Buy me AI tokens: 12M tokens</title>");
  });

  it("accepts a .svg suffix on the username", async () => {
    const plain = await (await getBadge("maker")).text();
    const suffixed = await (await getBadge("maker.svg")).text();

    expect(suffixed).toBe(plain);
    expect(suffixed).toContain("<title>Buy me AI tokens: 12M tokens</title>");
  });

  it("shows 0M tokens on the compact badge before the first support", async () => {
    const empty = await (await getBadge("ghost", "?style=flat")).text();
    expect(empty).toContain("<title>buy me AI tokens: 0M tokens</title>");
    expect(empty).not.toContain("support");

    const counted = await (await getBadge("maker", "?style=flat")).text();
    expect(counted).toContain("<title>buy me AI tokens: 12M tokens</title>");
  });

  it("falls back to the default style for an unknown style", async () => {
    const plain = await (await getBadge("maker")).text();
    const styled = await (await getBadge("maker", "?style=bogus")).text();

    expect(styled).toBe(plain);
  });

  it("falls back to the default theme for an unknown theme", async () => {
    const plain = await (await getBadge("maker")).text();
    const themed = await (await getBadge("maker", "?theme=bogus")).text();

    expect(themed).toBe(plain);
  });

  it("shows goal progress on the goal badge", async () => {
    await setGoal("maker", 50, NOW - 60_000);
    const svg = await (await getBadge("maker", "?style=goal")).text();

    expect(svg).toMatch(/^<svg[^>]* height="36"/);
    expect(svg).not.toContain('height="4"');
    expect(svg).toContain("24% of goal");
    expect(svg).toContain("12M / 50M");
  });

  it("falls back to the regular button badge when there is no goal", async () => {
    const svg = await (await getBadge("maker", "?style=goal")).text();

    expect(svg).toContain("Buy me AI tokens: 12M tokens");
  });

  it("shows the supporter count on the supporters badge", async () => {
    const svg = await (await getBadge("maker", "?style=supporters")).text();

    expect(svg).toContain("<title>Buy me AI tokens: 1 supporter</title>");
  });

  it("keeps every badge style at its declared height", async () => {
    await setGoal("maker", 50, NOW - 60_000);
    const cases: [string, number][] = [
      ["", 36],
      ["?style=flat", 20],
      ["?style=pill", 28],
      ["?style=goal", 36],
      ["?style=supporters", 36],
    ];
    for (const [search, height] of cases) {
      const svg = await (await getBadge("maker", search)).text();
      expect(svg).toMatch(new RegExp(`^<svg[^>]* height="${height}"`));
    }
  });

  it("escapes user-supplied text in the badge", () => {
    const svg = renderBadge('<script>alert("x")</script> & friends', "button", "dark");

    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp; friends");
  });
});
