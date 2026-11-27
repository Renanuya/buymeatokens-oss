import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: null as unknown as PGlite }));

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
import { supporterSummary } from "../src/lib/donations";
import { renderWall } from "../src/lib/wall";

const titleOf = (svg: string) => /<title>([^<]*)<\/title>/.exec(svg)?.[1] ?? "";
/** Every & starts an entity, so the SVG stays well-formed XML. */
const wellFormedAmps = (svg: string) => !/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(svg);

describe("renderWall", () => {
  it("invites the first supporter when there are none", () => {
    const svg = renderWall({ people: 0, units: 0, names: [] }, "light", "buymeatokens.com/maya");
    expect(titleOf(svg)).toBe("Be the first to buy me AI tokens");
    expect(svg).not.toContain('rx="13"'); // no token chip
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="480"')).toBe(true);
  });

  it("names supporters and counts the rest", () => {
    const one = renderWall({ people: 1, units: 3, names: ["Grace Hopper"] });
    expect(titleOf(one)).toBe("Supported by 1 person: Grace Hopper");

    const many = renderWall({ people: 214, units: 1530, names: ["A1", "B2", "C3", "D4", "E5", "F6", "G7"] });
    // Six cells: five names and the "+209 more" cell.
    expect(titleOf(many)).toBe("Supported by 214 people: A1, B2, C3, D4, E5, 209 more");

    const six = renderWall({ people: 6, units: 18, names: ["A", "B", "C", "D", "E", "F"] });
    expect(titleOf(six)).toBe("Supported by 6 people: A, B, C, D, E, F");
  });

  it("doesn't list names when every supporter stayed anonymous", () => {
    expect(titleOf(renderWall({ people: 3, units: 9, names: [] }))).toBe("Supported by 3 people");
  });

  it("escapes names, and writes characters the brand font lacks as system-font text", () => {
    const svg = renderWall({ people: 3, units: 3, names: ['<script>alert("x")</script>', "田中太郎", "Tom & Jerry"] });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain(">田中太郎</text>");
    expect(wellFormedAmps(svg)).toBe(true);
  });

  it("draws accented Latin names in the brand font", () => {
    const svg = renderWall({ people: 1, units: 1, names: ["Şükrü Özdoğan"] });
    expect(svg).not.toContain("<text");
  });

  it("shortens a long name to fit its column", () => {
    const svg = renderWall({ people: 1, units: 1, names: ["漢".repeat(40)] });
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    const text = texts.at(-1) ?? ""; // the first is the initial
    expect(text.endsWith("…")).toBe(true);
    expect(Array.from(text).length).toBeLessThan(20);
  });

  it("keeps names to one line", () => {
    const svg = renderWall({ people: 1, units: 1, names: ["Grace\nHopper "] });
    expect(titleOf(svg)).toBe("Supported by 1 person: Grace Hopper");
  });

  it("has a light and a dark look", () => {
    expect(renderWall({ people: 0, units: 0, names: [] }, "light")).toContain('fill="#ffffff"/>');
    expect(renderWall({ people: 0, units: 0, names: [] }, "dark")).toContain('rx="16" fill="#1c1c1e"');
  });
});

describe("supporterSummary", () => {
  let seq = 0;
  const pay = (name: string, at: number, extra: { status?: string; mode?: string; units?: number } = {}) =>
    query(
      `INSERT INTO donations (id, creator_id, stripe_mode, units, amount_cents, supporter_name, status, created_at, paid_at)
       VALUES (?, 'maker', ?, ?, 500, ?, ?, ?, ?)`,
      [`d${++seq}`, extra.mode ?? "live", extra.units ?? 1, name, extra.status ?? "paid", at, at],
    );

  beforeAll(async () => {
    mocks.db = new PGlite();
    await mocks.db.exec(SCHEMA);
  });

  beforeEach(async () => {
    await mocks.db.exec("TRUNCATE users CASCADE");
    await query("INSERT INTO users (id, auth_id, username, display_name, created_at) VALUES ('maker', 'github:1', 'maker', 'Maker', 0)");
  });

  afterAll(async () => {
    await mocks.db.close();
  });

  it("counts each named supporter once, every anonymous payment, and lists the newest first", async () => {
    await pay("Grace", 1);
    await pay("Linus", 2);
    await pay("  grace ", 3, { units: 2 }); // same person, newer
    await pay("", 4);
    await pay(" ", 5);
    await pay("Refunded", 6, { status: "failed" });
    await pay("Tester", 7, { mode: "test" });

    expect(await supporterSummary("maker", "live", 12)).toEqual({ people: 4, units: 6, names: ["grace", "Linus"] });
    expect(await supporterSummary("maker", "test", 12)).toEqual({ people: 1, units: 1, names: ["Tester"] });
  });

  it("stops at the limit", async () => {
    for (let i = 0; i < 5; i++) await pay(`Fan ${i}`, i);
    expect((await supporterSummary("maker", "live", 3)).names).toEqual(["Fan 4", "Fan 3", "Fan 2"]);
  });
});

describe("Analytics source for the wall", () => {
  it("credits visits from the supporter wall", async () => {
    const { classifyVisit, sourceLabel } = await import("../src/lib/visit-source");
    expect(classifyVisit({ ref: "wall", referrer: "https://github.com/maya/tiny-llm" })).toEqual({ source: "wall", detail: "" });
    expect(classifyVisit({ ref: "supporters" })).toEqual({ source: "wall", detail: "" });
    expect(sourceLabel({ source: "wall", detail: "" })).toBe("Supporter wall");
    // Tags we no longer hand out are ordinary tagged links.
    expect(classifyVisit({ ref: "sponsor" })).toEqual({ source: "tag", detail: "sponsor" });
  });
});
