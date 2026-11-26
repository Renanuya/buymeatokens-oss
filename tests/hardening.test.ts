import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAdmin } from "../src/lib/access";
import { decrypt, encrypt } from "../src/lib/crypto";

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  vi.stubEnv("ADMIN_GITHUB_LOGINS", "Octo-Admin, second");
});
afterEach(() => vi.unstubAllEnvs());

describe("Stripe key encryption", () => {
  it("round-trips with a fresh IV every time", () => {
    const a = encrypt("rk_test_abc");
    const b = encrypt("rk_test_abc");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("rk_test_abc");
  });

  it("refuses a truncated authentication tag", () => {
    const [iv, tag, data] = encrypt("rk_test_abc").split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decrypt([iv, short, data].join("."))).toThrow("Malformed");
  });

  it("refuses a tampered ciphertext", () => {
    const [iv, tag, data] = encrypt("rk_test_abc").split(".");
    const bytes = Buffer.from(data, "base64url");
    bytes[0] ^= 1;
    expect(() => decrypt([iv, tag, bytes.toString("base64url")].join("."))).toThrow();
  });
});

describe("isAdmin", () => {
  it("accepts listed GitHub logins, case-insensitively", () => {
    expect(isAdmin({ login: "octo-admin", authId: "github:1" })).toBe(true);
    expect(isAdmin({ login: "SECOND", authId: "github:2" })).toBe(true);
    expect(isAdmin({ login: "someone", authId: "github:3" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("never accepts a development login with an admin's name", () => {
    expect(isAdmin({ login: "octo-admin", authId: "dev:octo-admin" })).toBe(false);
  });
});

describe("githubRepo", () => {
  it("reads owner and repo from a GitHub link", async () => {
    const { githubRepo } = await import("../src/lib/profile");
    expect(githubRepo("https://github.com/octocat/hello-world")).toBe("octocat/hello-world");
    expect(githubRepo("https://github.com/octocat/hello-world.git")).toBe("octocat/hello-world");
    expect(githubRepo("https://example.com/octocat/hello-world")).toBeNull();
  });

  it("never returns a path that walks up a level", async () => {
    const { githubRepo } = await import("../src/lib/profile");
    expect(githubRepo("https://github.com/../..")).toBeNull();
    expect(githubRepo("https://github.com/octocat/..")).toBeNull();
    expect(githubRepo("https://github.com/./repo")).toBeNull();
    expect(githubRepo("https://github.com/octocat/.github")).toBe("octocat/.github");
  });
});
