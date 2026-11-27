import { PGlite } from "@electric-sql/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: null as unknown as PGlite,
  userId: "maker",
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
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
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
import { TERMS_VERSION } from "../src/lib/legal/config";
import { homePathFor } from "../src/lib/access";
import { GoalProgress, SocialLinks } from "../src/components/creator-profile";
import { unitsSince } from "../src/lib/donations";
import { normalizeProjectUrl, parseGoalUnits, parsePriceUsd, parseThankYou, projectNameFromUrl } from "../src/lib/profile";
import { SETUP_STEPS, canOpenStep, filledSteps, resumePath, setupProgress } from "../src/lib/setup";
import { CreatorPageBody } from "../src/components/creator-page";
import { loadCreatorPage } from "../src/lib/creator-page-data";
import { normalizeSocial, parseSocials, socialEntries, socialInputValue } from "../src/lib/socials";
import { getUserById } from "../src/lib/users";
import {
  advanceStepAction,
  checkUsernameAction,
  claimUsernameAction,
  saveDescriptionAction,
  saveGoalAction,
  savePriceAction,
  saveProjectAction,
  saveSocialsAction,
  saveTokenUseAction,
} from "../src/app/onboarding/actions";
import { updateProfileAction } from "../src/app/dashboard/actions";

const NOW = 1_800_000_000_000;
/** Both consent boxes ticked, as the page-claim form sends them. */
const AGREED = { acceptTerms: "on", confirmAge: "on" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs an action and returns where it redirected (or its returned state). */
async function run<T>(action: () => Promise<T>): Promise<{ redirect: string } | { state: T }> {
  try {
    return { state: await action() };
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

async function signup(id = "maker", login = "maker") {
  await query("INSERT INTO users (id, auth_id, login, display_name, created_at) VALUES (?, ?, ?, ?, ?)", [
    id,
    `github:${id}`,
    login,
    "Maker Person",
    NOW,
  ]);
  mocks.userId = id;
}

const user = async () => (await getUserById(mocks.userId))!;

beforeAll(async () => {
  mocks.db = new PGlite();
  await mocks.db.exec(SCHEMA);
});
beforeEach(async () => {
  await mocks.db.exec("TRUNCATE users CASCADE");
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  mocks.revalidatePath.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  await mocks.db.close();
});

describe("social links", () => {
  it.each([
    ["github", "@Octo-Cat", "https://github.com/Octo-Cat"],
    ["github", "https://github.com/octocat/hello-world", "https://github.com/octocat"],
    ["x", "@renan_dev", "https://x.com/renan_dev"],
    ["x", "https://twitter.com/renan_dev/status/1", "https://x.com/renan_dev"],
    ["bluesky", "@Renan.bsky.social", "https://bsky.app/profile/renan.bsky.social"],
    ["bluesky", "https://bsky.app/profile/renan.dev", "https://bsky.app/profile/renan.dev"],
    ["linkedin", "renan-u", "https://www.linkedin.com/in/renan-u"],
    ["linkedin", "https://tr.linkedin.com/in/renan-u/", "https://www.linkedin.com/in/renan-u"],
    ["linkedin", "linkedin.com/company/acme", "https://www.linkedin.com/company/acme"],
    ["youtube", "@channel", "https://www.youtube.com/@channel"],
    ["youtube", "youtube.com/channel/UC1234567890123456789012", "https://www.youtube.com/channel/UC1234567890123456789012"],
    ["discord", "https://discord.com/invite/abc123", "https://discord.gg/abc123"],
    ["website", "renan.dev", "https://renan.dev/"],
  ] as const)("normalizes %s %s", (key, input, url) => {
    expect(normalizeSocial(key, input)).toEqual({ url });
  });

  it.each([
    ["website", "javascript:alert(1)"],
    ["website", "https://user:pass@evil.com"],
    ["website", "localhost"],
    ["x", "this-handle-is-way-too-long"],
    ["github", "-bad-"],
    ["discord", "discord.gg/<script>"],
  ] as const)("rejects %s %s", (key, input) => {
    expect(normalizeSocial(key, input)).toHaveProperty("error");
  });

  it("treats empty input as removal and drops bad stored data", () => {
    expect(normalizeSocial("x", "  ")).toEqual({ url: null });
    expect(parseSocials('{"x":"https://x.com/ok","website":"javascript:alert(1)","evil":"https://e.com"}')).toEqual({
      x: "https://x.com/ok",
    });
    expect(parseSocials("not json")).toEqual({});
    expect(parseSocials("[1,2]")).toEqual({});
  });

  it("round-trips the short input value and renders safe links", () => {
    expect(socialInputValue("github", "https://github.com/octocat")).toBe("octocat");
    expect(socialInputValue("linkedin", "https://www.linkedin.com/in/renan")).toBe("in/renan");
    expect(normalizeSocial("linkedin", "in/renan")).toEqual({ url: "https://www.linkedin.com/in/renan" });
    const entries = socialEntries({ website: "https://renan.dev/", github: "https://github.com/octocat" });
    expect(entries.map((e) => e.key)).toEqual(["github", "website"]);
    const html = renderToStaticMarkup(<SocialLinks socials={{ x: "https://x.com/renan" }} />);
    expect(html).toContain('href="https://x.com/renan"');
    expect(html).toContain('rel="me noopener noreferrer nofollow"');
    expect(html).toContain("@renan");
  });
});

describe("page detail parsing", () => {
  it("validates price, goal and project links", () => {
    expect(parsePriceUsd("5")).toBe(5);
    expect(parsePriceUsd("0")).toBeNull();
    expect(parsePriceUsd("101")).toBeNull();
    expect(parsePriceUsd("4.5")).toBeNull();
    expect(parseGoalUnits("")).toEqual({ units: null });
    expect(parseGoalUnits("50M")).toEqual({ units: 50 });
    expect(parseGoalUnits("1,000")).toEqual({ units: 1000 });
    expect(parseGoalUnits("0")).toHaveProperty("error");
    expect(parseGoalUnits("100001")).toHaveProperty("error");
    expect(normalizeProjectUrl("github.com/me/tool.git")).toEqual({ url: "https://github.com/me/tool" });
    expect(normalizeProjectUrl("https://github.com/me/tool/tree/main?x=1")).toEqual({ url: "https://github.com/me/tool" });
    expect(normalizeProjectUrl("https://github.com/me")).toHaveProperty("error");
    expect(normalizeProjectUrl("ftp://files.example.com")).toHaveProperty("error");
    expect(normalizeProjectUrl("mytool.dev/docs")).toEqual({ url: "https://mytool.dev/docs" });
    expect(projectNameFromUrl("https://github.com/me/tool")).toBe("tool");
    expect(projectNameFromUrl("https://www.mytool.dev/")).toBe("mytool.dev");
  });

  it("draws the goal bar with a floor, a cap and a finished state", () => {
    const empty = renderToStaticMarkup(<GoalProgress reached={0} goal={50} />);
    expect(empty).toContain("width:0%");
    const started = renderToStaticMarkup(<GoalProgress reached={1} goal={1000} />);
    expect(started).toContain("width:3%");
    const done = renderToStaticMarkup(<GoalProgress reached={60} goal={50} />);
    expect(done).toContain("width:100%");
    expect(done).toContain("Goal reached");
  });
});

describe("guided setup", () => {
  it("walks a new creator through every step in order and finishes", async () => {
    await signup();
    expect(homePathFor(await user())).toBe("/onboarding");
    expect(resumePath(await user())).toBe("/onboarding/name");

    // Steps ahead of the creator can't be skipped into.
    expect(await run(() => advanceStepAction(form({ step: "socials" })))).toEqual({ redirect: "/onboarding" });

    expect(await run(() => claimUsernameAction({}, form({ username: "Maker", displayName: "  Maker  ", ...AGREED })))).toEqual({
      redirect: "/onboarding/payments",
    });
    expect((await user()).username).toBe("maker");
    expect(homePathFor(await user())).toBe("/onboarding/payments");
    expect(await run(() => advanceStepAction(form({ step: "socials" })))).toEqual({ redirect: "/onboarding/payments" });

    expect(await run(() => advanceStepAction(form({ step: "payments" })))).toEqual({ redirect: "/onboarding/price" });
    expect(await run(() => savePriceAction({}, form({ price: "0" })))).toEqual({
      state: { error: expect.stringContaining("between $1 and $100") },
    });
    expect(await run(() => savePriceAction({}, form({ price: "7" })))).toEqual({ redirect: "/onboarding/project" });
    expect((await user()).unitPriceCents).toBe(700);

    expect(await run(() => saveProjectAction({}, form({ projectUrl: "github.com/maker/tool", projectName: "" })))).toEqual({
      redirect: "/onboarding/description",
    });
    expect(await user()).toMatchObject({ projectUrl: "https://github.com/maker/tool", projectName: "tool" });

    expect(await run(() => saveDescriptionAction({}, form({ bio: "   " })))).toEqual({
      state: { error: expect.stringContaining("skip") },
    });
    expect(await run(() => saveDescriptionAction({}, form({ bio: "**Tool** for makers." })))).toEqual({
      redirect: "/onboarding/tokens",
    });
    expect(await run(() => saveTokenUseAction({}, form({ tokenUse: "x".repeat(501) })))).toEqual({
      state: { error: expect.stringContaining("500") },
    });
    expect(await run(() => saveTokenUseAction({}, form({ tokenUse: " Claude Code for refactors \n" })))).toEqual({
      redirect: "/onboarding/goal",
    });
    expect((await user()).tokenUse).toBe("Claude Code for refactors");

    expect(await run(() => saveGoalAction({}, form({ goal: "50" })))).toEqual({ redirect: "/onboarding/socials" });
    expect(await user()).toMatchObject({ goalUnits: 50, goalStartedAt: NOW });

    expect(await run(() => saveSocialsAction({}, form({ social_x: "not a handle!" })))).toEqual({
      state: { error: expect.stringContaining("X:") },
    });
    expect((await user()).setupDoneAt).toBeNull();
    expect(
      await run(() => saveSocialsAction({}, form({ social_github: "maker", social_website: "maker.dev" }))),
    ).toEqual({ redirect: "/onboarding/done" });

    const done = await user();
    expect(done.socials).toEqual({ github: "https://github.com/maker", website: "https://maker.dev/" });
    expect(done.setupDoneAt).toBe(NOW);
    expect(setupProgress(done)).toBe(8);
    expect(homePathFor(done)).toBe("/dashboard");
    expect(filledSteps(done)).toEqual({
      name: true, payments: false, price: true, project: true, description: true, tokens: true, goal: true, socials: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/maker");
  });

  it("lets a creator go back without losing their place, and returns finished creators to the summary", async () => {
    await signup();
    await run(() => claimUsernameAction({}, form({ username: "maker", displayName: "Maker", ...AGREED })));
    await run(() => advanceStepAction(form({ step: "payments" })));
    await run(() => savePriceAction({}, form({ price: "5" })));
    // Back to step 1: the address is kept, only the display name changes, and progress doesn't drop.
    expect(await run(() => claimUsernameAction({}, form({ username: "other", displayName: "New Name", ...AGREED })))).toEqual({
      redirect: "/onboarding/payments",
    });
    expect(await user()).toMatchObject({ username: "maker", displayName: "New Name", setupProgress: 3 });
    expect(resumePath(await user())).toBe("/onboarding/project");
    expect(canOpenStep(await user(), "project")).toBe(true);
    expect(canOpenStep(await user(), "description")).toBe(false);

    for (const step of ["project", "description", "tokens"]) await run(() => advanceStepAction(form({ step })));
    await run(() => saveGoalAction({}, form({ goal: "" })));
    expect(await run(() => advanceStepAction(form({ step: "socials" })))).toEqual({ redirect: "/onboarding/done" });
    expect((await user()).goalUnits).toBeNull();
    expect(await run(() => saveGoalAction({}, form({ goal: "25" })))).toEqual({ redirect: "/onboarding/done" });
  });

  it("refuses names that are taken, reserved or malformed", async () => {
    await signup("first");
    await run(() => claimUsernameAction({}, form({ username: "taken", displayName: "First", ...AGREED })));
    await signup("second", "second");
    expect(await checkUsernameAction("Taken")).toEqual({ available: false, message: expect.stringContaining("taken") });
    expect(await checkUsernameAction("admin")).toMatchObject({ available: false });
    expect(await checkUsernameAction("a")).toMatchObject({ available: false });
    expect(await checkUsernameAction("free-name")).toEqual({ available: true, message: "Available" });
    expect(await run(() => claimUsernameAction({}, form({ username: "taken", displayName: "Second", ...AGREED })))).toEqual({
      state: { error: expect.stringContaining("taken") },
    });
    expect(await run(() => claimUsernameAction({}, form({ username: "free-name", displayName: "", ...AGREED })))).toEqual({
      state: { error: expect.stringContaining("name supporters will see") },
    });
  });
});

describe("existing creators and goals", () => {
  it("marks pages claimed before the guided setup as done, exactly once", async () => {
    const db = new PGlite();
    await db.exec(SCHEMA.split("-- Guided setup")[0]);
    await db.exec(`INSERT INTO users (id, auth_id, username, created_at) VALUES ('old', 'github:1', 'old', 1)`);
    await db.exec(`INSERT INTO users (id, auth_id, created_at) VALUES ('fresh', 'github:2', 1)`);
    await db.exec(SCHEMA);
    // Someone claims a page after the migration; running the schema again must not skip their setup.
    await db.exec(`UPDATE users SET username = 'fresh' WHERE id = 'fresh'`);
    await db.exec(SCHEMA);
    const rows = (await db.query<{ id: string; setup_done_at: string | null }>("SELECT id, setup_done_at FROM users ORDER BY id")).rows;
    expect(rows.find((r) => r.id === "old")?.setup_done_at).not.toBeNull();
    expect(rows.find((r) => r.id === "fresh")?.setup_done_at).toBeNull();
    await db.close();
  });

  it("counts goal progress from when the goal was set and keeps it when the number changes", async () => {
    await signup();
    await query("UPDATE users SET username = 'maker', setup_done_at = 1, terms_version = ?, terms_accepted_at = 1, age_confirmed_at = 1 WHERE id = 'maker'", [TERMS_VERSION]);
    const pay = (id: string, units: number, paidAt: number, mode = "live") =>
      query(
        `INSERT INTO donations (id, creator_id, stripe_mode, units, amount_cents, status, created_at, paid_at)
         VALUES (?, 'maker', ?, ?, 500, 'paid', ?, ?)`,
        [id, mode, units, paidAt, paidAt],
      );
    await pay("before", 5, NOW - 1000);
    await run(() => saveGoalAction({}, form({ goal: "10" })));
    await pay("after", 3, NOW + 1000);
    await pay("test", 4, NOW + 2000, "test");
    expect(await unitsSince("maker", "live", (await user()).goalStartedAt!)).toBe(3);

    vi.spyOn(Date, "now").mockReturnValue(NOW + 5000);
    await run(() => saveGoalAction({}, form({ goal: "20" })));
    expect(await user()).toMatchObject({ goalUnits: 20, goalStartedAt: NOW });
    await run(() => saveGoalAction({}, form({ goal: "" })));
    expect(await user()).toMatchObject({ goalUnits: null, goalStartedAt: null });
    await run(() => saveGoalAction({}, form({ goal: "20" })));
    expect((await user()).goalStartedAt).toBe(NOW + 5000);
  });

  it("saves every page detail from the settings form, and leaves absent ones alone", async () => {
    await signup();
    await query(
      "UPDATE users SET username = 'maker', setup_done_at = 1, token_use = 'keep', socials = ?, terms_version = ?, terms_accepted_at = 1, age_confirmed_at = 1 WHERE id = 'maker'",
      ['{"x":"https://x.com/keep"}', TERMS_VERSION],
    );
    expect(await updateProfileAction({}, form({ displayName: "Maker", bio: "", price: "5" }))).toEqual({
      message: expect.stringContaining("Saved"),
    });
    expect(await user()).toMatchObject({ tokenUse: "keep", socials: { x: "https://x.com/keep" } });

    const full = form({
      displayName: "Maker",
      bio: "About",
      price: "9",
      projectUrl: "https://maker.dev",
      projectName: "",
      tokenUse: "Evals",
      goal: "100",
      social_x: "",
      social_youtube: "@maker",
    });
    expect(await updateProfileAction({}, full)).toEqual({ message: expect.stringContaining("Saved") });
    expect(await user()).toMatchObject({
      unitPriceCents: 900,
      projectUrl: "https://maker.dev/",
      projectName: "maker.dev",
      tokenUse: "Evals",
      goalUnits: 100,
      socials: { youtube: "https://www.youtube.com/@maker" },
    });
    full.set("social_website", "javascript:alert(1)");
    expect(await updateProfileAction({}, full)).toEqual({ error: expect.stringContaining("Website:") });
    full.set("social_website", "");
    full.set("projectUrl", "");
    await updateProfileAction({}, full);
    expect(await user()).toMatchObject({ projectUrl: null, projectName: null });
  });
});

describe("thank-you note", () => {
  async function creatorPage() {
    await query("UPDATE users SET login = NULL WHERE id = 'maker'");
    return renderToStaticMarkup(<CreatorPageBody page={await loadCreatorPage(await user())} />);
  }

  it("cleans the text and enforces the limit", () => {
    expect(parseThankYou("  Thanks \n\n  a lot\t! ")).toEqual({ text: "Thanks a lot !" });
    expect(parseThankYou("a‮b​c\u0000d⁦e﻿")).toEqual({ text: "abc de" });
    expect(parseThankYou(null)).toEqual({ text: "" });
    expect(parseThankYou("x".repeat(280))).toEqual({ text: "x".repeat(280) });
    expect(parseThankYou(`  ${"x".repeat(281)}`)).toEqual({ error: expect.stringContaining("280") });
  });

  it("is saved from the guided setup step, which stays the tokens step", async () => {
    await signup();
    await query("UPDATE users SET username = 'maker', setup_progress = 5, terms_version = ?, terms_accepted_at = 1, age_confirmed_at = 1 WHERE id = 'maker'", [TERMS_VERSION]);
    expect(await run(() => saveTokenUseAction({}, form({ tokenUse: "Evals", thankYou: "x".repeat(281) })))).toEqual({
      state: { error: expect.stringContaining("280") },
    });
    expect(await run(() => saveTokenUseAction({}, form({ tokenUse: "", thankYou: "" })))).toEqual({
      state: { error: expect.stringContaining("skip") },
    });
    expect(await run(() => saveTokenUseAction({}, form({ tokenUse: "Evals", thankYou: " Thanks!\n" })))).toEqual({
      redirect: "/onboarding/goal",
    });
    expect(await user()).toMatchObject({ tokenUse: "Evals", thankYou: "Thanks!", setupProgress: 6 });
  });

  it("is saved from settings, left alone when absent, and survives a crafted submission", async () => {
    await signup();
    await query("UPDATE users SET username = 'maker', setup_done_at = 1, thank_you = 'keep', terms_version = ?, terms_accepted_at = 1, age_confirmed_at = 1 WHERE id = 'maker'", [TERMS_VERSION]);
    await updateProfileAction({}, form({ displayName: "Maker", bio: "", price: "5" }));
    expect((await user()).thankYou).toBe("keep");
    expect(await updateProfileAction({}, form({ displayName: "Maker", price: "5", thankYou: "a‮<b>x</b>\r\n\r\nb" }))).toEqual({
      message: expect.stringContaining("Saved"),
    });
    expect((await user()).thankYou).toBe("a<b>x</b> b");
    expect(await updateProfileAction({}, form({ displayName: "Maker", price: "5", thankYou: "x".repeat(5000) }))).toEqual({
      error: expect.stringContaining("280"),
    });
    expect((await user()).thankYou).toBe("a<b>x</b> b");
    await updateProfileAction({}, form({ displayName: "Maker", price: "5", thankYou: "  " }));
    expect((await user()).thankYou).toBe("");
  });

  it("shows on the public page as text, and nothing when empty", async () => {
    await signup();
    await query("UPDATE users SET username = 'maker', setup_done_at = 1 WHERE id = 'maker'");
    const without = await creatorPage();
    expect(without).not.toContain("Thanks for the fuel");
    await query("UPDATE users SET thank_you = ? WHERE id = 'maker'", ["Thanks for the fuel <script>alert(1)</script> [x](javascript:alert(1))"]);
    const html = await creatorPage();
    expect(html).toContain("Thanks for the fuel &lt;script&gt;alert(1)&lt;/script&gt; [x](javascript:alert(1))");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain('href="javascript');
    expect(html.length).toBeGreaterThan(without.length);
    expect(without).toContain("No supporters yet");
  });

  it("leaves every creator's setup progress as it was", async () => {
    expect(SETUP_STEPS.map((s) => s.slug)).toEqual(["name", "payments", "price", "project", "description", "tokens", "goal", "socials"]);
    const base = { username: "maker", setupDoneAt: null };
    expect(resumePath({ ...base, setupProgress: 5 })).toBe("/onboarding/tokens");
    expect(resumePath({ ...base, setupProgress: 8 })).toBe("/onboarding/done");
    expect(resumePath({ ...base, setupProgress: 8, setupDoneAt: 1 })).toBe("/dashboard");
    expect(setupProgress({ ...base, setupProgress: 6 })).toBe(6);
  });

  it("applies the schema twice and adds one column", async () => {
    await mocks.db.exec(SCHEMA);
    await mocks.db.exec(SCHEMA);
    const { rows } = await mocks.db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'thank_you'");
    expect(rows).toHaveLength(1);
  });
});
