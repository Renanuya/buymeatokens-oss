import { describe, expect, it } from "vitest";
import { OFFICIAL_CONTACT, nameRule } from "../src/lib/username-rules";
import { suggestUsername, validateUsername } from "../src/lib/validation";

const rules = (names: string[]) => Object.fromEntries(names.map((n) => [n, nameRule(n)]));
const every = (names: string[], rule: ReturnType<typeof nameRule>) =>
  expect(rules(names)).toEqual(Object.fromEntries(names.map((n) => [n, rule])));

describe("handles nobody can take", () => {
  it("keeps every top-level route, including the newer ones", () => {
    every(["apply", "directory", "leaderboard", "opengraph-image", "twitter-image", "sounds", "widget", "dashboard", "api"], "reserved");
  });

  it("keeps handles that read as the site or its staff", () => {
    every(["support", "official-support", "admin1", "the-team", "staff", "hello", "destek", "resmi-destek"], "reserved");
    every(["buymeatokens", "buymeatokens-help", "buy-me-a-token", "real-buymeatokens"], "reserved");
  });

  it("never gives out Atatürk or a state institution, in any spelling", () => {
    every(["ataturk", "ataturk1881", "mustafa-kemal-ataturk", "gazi-mustafa-kemal", "4taturk", "at4turk", "ataturkcu"], "protected");
    every(["tbmm", "tccb-official", "edevlet-destek", "cumhurbaskanligi"], "protected");
  });

  it("keeps official names, dressed up or disguised", () => {
    every(
      [
        "openai", "open-ai", "0penai", "openai2", "openai-support", "the-real-openai", "my-openai-wallet", "chatgpt-pro",
        "anthropic", "claude", "claude-ai", "c1aude", "paypal-help", "stripe-payments", "github-official", "google-destek",
        "googletr", "g00gle", "meta", "binance-iade",
      ],
      "official",
    );
  });

  it("lets ordinary handles through, including ones that only contain a name", () => {
    every(
      [
        "renanuya", "philanthropic-dev", "stripes", "github-readme-stats", "metadata", "gptcli", "awesome-lists",
        "teamviewer-tools", "realtime-chat", "kemal", "mustafa", "ata-dev", "claude-fan", "trend", "helloworld", "web3",
        "applesauce", "app-store", "mail-merge",
      ],
      null,
    );
  });
});

describe("validateUsername", () => {
  it("says why, and only offers the email for official names", () => {
    expect(validateUsername("leaderboard")).toBe("That username is reserved. Try another one.");
    expect(validateUsername("ataturk")).toBe("That name is protected and can't be used. Try another one.");
    expect(validateUsername("ataturk")).not.toContain("@");
    const official = validateUsername("openai")!;
    expect(official).toContain("official owner");
    expect(official).toContain(OFFICIAL_CONTACT);
    expect(validateUsername("renanuya")).toBeNull();
  });

  it("checks the shape first", () => {
    expect(validateUsername("ab")).toContain("3–30");
    expect(validateUsername("Open-AI")).toContain("3–30");
  });
});

describe("suggestUsername", () => {
  it("never suggests a name the claim would refuse", () => {
    expect(suggestUsername("OpenAI")).toBe("");
    expect(suggestUsername("ataturk")).toBe("");
    expect(suggestUsername("support")).toBe("");
    expect(suggestUsername("Renan_Uya")).toBe("renan-uya");
  });
});
