import { describe, expect, it } from "vitest";
import { cardLines, cardName, cardStats, plainText, wordCut } from "../src/lib/creator-card";
import { websiteSnippet } from "../src/components/website-builder";

describe("creator card text", () => {
  it("sizes the name to fit, and cuts very long ones", () => {
    expect(cardName("Maya Chen")).toEqual({ text: "Maya Chen", size: 84 });
    expect(cardName("Margaret Hamilton").size).toBe(72);
    expect(cardName("Grace Brewster Hopper").size).toBe(60);
    const long = cardName("Hubert Blaine Wolfeschlegelsteinhausenbergerdorff");
    expect(long.size).toBe(52);
    expect(Array.from(long.text)).toHaveLength(32);
    expect(long.text.endsWith("…")).toBe(true);
    expect(cardName("  \n ").text).toBe("A creator");
  });

  it("turns the description's Markdown into plain words", () => {
    expect(plainText("## Hi\n**Fast** [docs](https://x.dev) ![logo](a.png) `npm i`\n- one\n> quote")).toBe(
      "Hi\nFast docs   npm i\none\nquote",
    );
  });

  it("puts the project first and the description second", () => {
    expect(cardLines({ projectName: "tiny-llm", bio: "Small **models** on microcontrollers." })).toEqual([
      "Building tiny-llm",
      "Small models on microcontrollers.",
    ]);
    expect(cardLines({ projectName: null, bio: "" })).toEqual([]);
    const [only] = cardLines({ projectName: null, bio: "word ".repeat(60) });
    expect(Array.from(only).length).toBeLessThanOrEqual(110);
  });

  it("ends a shortened description on a whole word", () => {
    const bio =
      "Buy Me a Tokens is an open-source alternative to Buy Me a Coffee, designed for the AI era. I built it because tokens cost money.";
    const [, line] = cardLines({ projectName: "Buy Me a Tokens", bio });
    // A sentence ends close to the limit: stop there.
    expect(line).toBe("Buy Me a Tokens is an open-source alternative to Buy Me a Coffee, designed for the AI era.");
    // Otherwise a whole word and "…".
    expect(wordCut("Small language models running on cheap microcontrollers with almost no memory at all", 50)).toBe(
      "Small language models running on cheap…",
    );
    expect(wordCut("short enough", 40)).toBe("short enough");
    // One huge word is cut where it has to be.
    expect(wordCut(`a ${"x".repeat(80)}`, 20)).toBe(`a ${"x".repeat(17)}…`);
  });

  it("shows the goal, else the totals, else an invitation", () => {
    expect(cardStats({ units: 12, supporters: 3, goal: { units: 50, reached: 12 } })).toEqual({
      kind: "goal",
      label: "12M of 50M tokens",
      percent: 24,
    });
    expect(cardStats({ units: 80, supporters: 3, goal: { units: 50, reached: 80 } })).toMatchObject({ percent: 100 });
    expect(cardStats({ units: 1, supporters: 1, goal: null })).toEqual({ kind: "totals", label: "1M tokens from 1 supporter" });
    expect(cardStats({ units: 1200, supporters: 31, goal: null }).label).toBe("1.2B tokens from 31 supporters");
    expect(cardStats({ units: 0, supporters: 0, goal: null })).toEqual({ kind: "first", label: "Be the first to buy me AI tokens" });
  });
});

describe("website snippet", () => {
  const args = ["https://buymeatokens.com", "maya", "https://buymeatokens.com/maya"] as const;

  it("loads the script with only the options that differ from the defaults", () => {
    expect(websiteSnippet("floating", "dark", ...args)).toBe(
      '<script src="https://buymeatokens.com/widget.js" data-user="maya" async></script>',
    );
    expect(websiteSnippet("inline", "iris", ...args)).toBe(
      '<script src="https://buymeatokens.com/widget.js" data-user="maya" data-mode="inline" data-theme="iris" async></script>',
    );
  });

  it("gives sites without scripts an image link with the badge", () => {
    expect(websiteSnippet("image", "light", ...args)).toBe(
      '<a href="https://buymeatokens.com/maya"><img src="https://buymeatokens.com/api/badge/maya?theme=light" alt="Buy me AI tokens" height="36"></a>',
    );
  });
});
