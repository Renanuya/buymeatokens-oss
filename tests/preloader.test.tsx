import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Preloader } from "../src/components/preloader";

// The intro must not replay when the landing page is mounted again by a client-side navigation.

afterEach(() => vi.unstubAllGlobals());

describe("Preloader", () => {
  it("renders on a fresh load", () => {
    expect(renderToStaticMarkup(<Preloader />)).toContain("preloader");
  });

  it("stays away once the intro has played in this tab", () => {
    vi.stubGlobal("document", { documentElement: { classList: { contains: (c: string) => c === "bmt-ready" } } });
    expect(renderToStaticMarkup(<Preloader />)).toBe("");
  });
});
