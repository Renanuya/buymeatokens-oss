import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Preloader } from "../src/components/preloader";
import { INTRO_KEY, INTRO_SCRIPT, introAlreadyPlayed, markIntroPlayed } from "../src/lib/intro";

// The intro plays once per tab: a reload, a full page load or a client-side navigation never replays it.

afterEach(() => vi.unstubAllGlobals());

/** Runs the <head> script against a fake document and storage, and returns the classes it put on <html>. */
function runHeadScript(storage: Pick<Storage, "getItem">): string[] {
  const classes = new Set<string>();
  const document = { documentElement: { classList: { add: (...names: string[]) => names.forEach((n) => classes.add(n)) } } };
  new Function("document", "sessionStorage", INTRO_SCRIPT)(document, storage);
  return [...classes];
}

const memoryStorage = (values: Record<string, string> = {}) => ({
  getItem: (k: string) => values[k] ?? null,
  setItem: (k: string, v: string) => void (values[k] = v),
});
const blockedStorage = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

describe("Preloader", () => {
  it("is in the server HTML, so hydration matches whatever the browser remembers", () => {
    expect(renderToStaticMarkup(<Preloader />)).toContain("preloader");
  });
});

describe("the <head> script", () => {
  it("hides the intro and lets the hero start when it already played in this tab", () => {
    expect(runHeadScript(memoryStorage({ [INTRO_KEY]: "1" }))).toEqual(["bmt-intro-seen", "bmt-ready"]);
  });

  it("does nothing in a new tab", () => {
    expect(runHeadScript(memoryStorage())).toEqual([]);
  });

  it("does nothing, and doesn't throw, when storage is blocked", () => {
    expect(runHeadScript(blockedStorage)).toEqual([]);
  });
});

describe("the flag", () => {
  const html = (classes: string[] = []) => ({ documentElement: { classList: { contains: (c: string) => classes.includes(c) } } });

  it("is set when the intro has played and read back on the next load", () => {
    const storage = memoryStorage();
    vi.stubGlobal("document", html());
    vi.stubGlobal("sessionStorage", storage);
    expect(introAlreadyPlayed()).toBe(false);
    markIntroPlayed();
    expect(introAlreadyPlayed()).toBe(true);
  });

  it("counts an intro that played earlier in this document", () => {
    vi.stubGlobal("document", html(["bmt-ready"]));
    vi.stubGlobal("sessionStorage", memoryStorage());
    expect(introAlreadyPlayed()).toBe(true);
  });

  it("survives blocked storage", () => {
    vi.stubGlobal("document", html());
    vi.stubGlobal("sessionStorage", blockedStorage);
    expect(() => markIntroPlayed()).not.toThrow();
    expect(introAlreadyPlayed()).toBe(false);
  });
});
