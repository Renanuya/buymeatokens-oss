import { describe, expect, it } from "vitest";
import { initials } from "../src/lib/format";

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("ünal")).toBe("ÜN");
    expect(initials("")).toBe("?");
  });

  // Half an emoji is an invalid character: the server and the browser print it differently and React
  // fails to hydrate the creator page.
  it("never cuts an emoji in half", () => {
    expect(initials("Zoë 🚀")).toBe("Z🚀");
    expect(initials("🚀")).toBe("🚀");
    expect(initials("🚀🎉 x").isWellFormed()).toBe(true);
  });
});
