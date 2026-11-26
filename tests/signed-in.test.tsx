import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreatorPageCta } from "../src/components/creator-page-cta";
import { SiteHeader } from "../src/components/site-header";
import type { User } from "../src/lib/users";
import { StartCta } from "../src/components/start-cta";
import { SIGNED_IN_PATTERN, SIGNED_IN_SCRIPT } from "../src/lib/signed-in-hint";

/** Runs the <head> script against a fake document and returns what it set. */
function runScript(cookie: string): string | undefined {
  const documentElement = { dataset: {} as Record<string, string> };
  new Function("document", SIGNED_IN_SCRIPT)({ cookie, documentElement });
  return documentElement.dataset.auth;
}

/** The markup inside the first wrapper with this class. */
function variant(html: string, name: "auth-in" | "auth-out"): string {
  const start = html.indexOf(`<span class="${name}">`);
  expect(start, name).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html.startsWith("<span", i)) depth++;
    if (html.startsWith("</span>", i) && --depth === 0) return html.slice(start, i);
  }
  throw new Error(`unclosed ${name}`);
}

describe("signed-in hint", () => {
  it("marks the page signed in only for the exact hint cookie", () => {
    expect(runScript("bmt_signed_in=1")).toBe("in");
    expect(runScript("theme=dark; bmt_signed_in=1; other=2")).toBe("in");
    expect(runScript("")).toBeUndefined();
    expect(runScript("bmt_signed_in=")).toBeUndefined();
    expect(runScript("bmt_signed_in=10")).toBeUndefined();
    expect(runScript("xbmt_signed_in=1")).toBeUndefined();
    expect(SIGNED_IN_PATTERN.test("a=1;bmt_signed_in=1")).toBe(true);
  });

  it("never throws, even without a readable cookie", () => {
    expect(() => new Function("document", SIGNED_IN_SCRIPT)({})).not.toThrow();
  });
});

describe("calls to action", () => {
  it("offers sign-up when signed out and the dashboard when signed in, in the header", () => {
    const html = renderToStaticMarkup(<SiteHeader />);
    const out = variant(html, "auth-out");
    const inn = variant(html, "auth-in");
    expect(out).toContain('href="/apply"');
    expect(out).toContain('href="/login"');
    expect(out).toContain("Create your page");
    expect(inn).toContain('href="/dashboard"');
    expect(inn).toContain('href="/dashboard/settings"');
    expect(inn).toContain("Edit page");
    expect(inn).not.toMatch(/Create your page|Log in|\/apply|\/login/);
  });

  it("sends signed-in visitors on the home page to their dashboard", () => {
    const html = renderToStaticMarkup(<StartCta livePageHref="/someone" />);
    const out = variant(html, "auth-out");
    const inn = variant(html, "auth-in");
    expect(out).toContain('href="/api/auth/github"');
    expect(inn).toContain('href="/dashboard"');
    expect(inn).toContain("Go to your dashboard");
    expect(inn).not.toMatch(/Create your page|\/api\/auth\/github/);
  });
});

describe("creator page header link", () => {
  const viewer = (fields: Partial<User>) =>
    ({ id: "me", authId: "github:1", login: "me", username: "me", accessStatus: null, setupProgress: 8, setupDoneAt: 1, ...fields }) as User;
  // Our own rendered markup, reduced to its visible words.
  const text = (html: string) => html.split(/<[^>]*>/).join("").split(/\s+/).filter(Boolean).join(" ");
  const render = (v: User | null) => renderToStaticMarkup(<CreatorPageCta viewer={v} creatorId="owner" />);

  it("lets the owner edit their page", () => {
    const html = render(viewer({ id: "owner" }));
    expect(html).toContain('href="/dashboard/settings"');
    expect(text(html)).toBe("Edit your page");
  });

  it("sends another signed-in creator to their own page", () => {
    const html = render(viewer({}));
    expect(html).toContain('href="/me"');
    expect(text(html)).toContain("View your page");
    expect(html).not.toMatch(/Edit|Get your/);
  });

  it("sends someone still in setup back to it", () => {
    const html = render(viewer({ username: null, setupProgress: 0, setupDoneAt: null }));
    expect(html).toContain('href="/onboarding"');
    expect(text(html)).toBe("Finish your page");
  });

  it("invites visitors who aren't signed in to get a page", () => {
    const html = render(null);
    expect(html).toContain('href="/apply"');
    expect(text(html)).toContain("Get your own page");
  });
});
