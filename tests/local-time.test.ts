import { describe, expect, it } from "vitest";
import { isTimeZone, nextLocalHour, timeZoneFromLocation } from "../src/lib/local-time";

const at = (iso: string) => Date.parse(iso);

describe("local morning scheduling", () => {
  it("finds the next 10:00 in each creator's own time zone", () => {
    const now = at("2026-11-24T18:20:00Z"); // 21:20 in Istanbul, 02:20 next day in Shanghai
    expect(new Date(nextLocalHour(now, "Europe/Istanbul", 10)).toISOString()).toBe("2026-11-25T07:00:00.000Z");
    expect(new Date(nextLocalHour(now, "Europe/Paris", 10)).toISOString()).toBe("2026-11-25T09:00:00.000Z");
    expect(new Date(nextLocalHour(now, "Asia/Shanghai", 10)).toISOString()).toBe("2026-11-25T02:00:00.000Z");
    expect(new Date(nextLocalHour(now, "America/Los_Angeles", 10)).toISOString()).toBe("2026-11-25T18:00:00.000Z");
  });

  it("uses today when 10:00 is still ahead and handles daylight saving changes", () => {
    expect(new Date(nextLocalHour(at("2026-11-25T01:00:00Z"), "Asia/Shanghai", 10)).toISOString()).toBe("2026-11-25T02:00:00.000Z");
    expect(new Date(nextLocalHour(at("2026-11-25T02:00:00Z"), "Asia/Shanghai", 10)).toISOString()).toBe("2026-11-26T02:00:00.000Z");
    // New York switches to EDT (UTC-4) at 02:00 on 8 March 2026.
    expect(new Date(nextLocalHour(at("2026-03-07T20:00:00Z"), "America/New_York", 10)).toISOString()).toBe("2026-03-08T14:00:00.000Z");
    // Paris returns to CET (UTC+1) on 25 October 2026.
    expect(new Date(nextLocalHour(at("2026-10-24T12:00:00Z"), "Europe/Paris", 10)).toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("maps only unambiguous GitHub locations", () => {
    expect(timeZoneFromLocation("turkey/istanbul")).toBe("Europe/Istanbul");
    expect(timeZoneFromLocation("Istanbul/Turkey")).toBe("Europe/Istanbul");
    expect(timeZoneFromLocation("Antalya")).toBe("Europe/Istanbul");
    expect(timeZoneFromLocation("China")).toBe("Asia/Shanghai");
    expect(timeZoneFromLocation("France")).toBe("Europe/Paris");
    expect(timeZoneFromLocation("Bengaluru, India")).toBe("Asia/Kolkata");
    expect(timeZoneFromLocation("Indiana")).toBeNull();
    expect(timeZoneFromLocation("Earth")).toBeNull();
    expect(timeZoneFromLocation(null)).toBeNull();
    expect(isTimeZone("Europe/Istanbul")).toBe(true);
    expect(isTimeZone("Mars/Base")).toBe(false);
  });
});
