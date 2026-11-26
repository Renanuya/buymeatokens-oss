import { describe, expect, it } from "vitest";

import { paypalCheckoutUrl, toCents } from "../src/lib/paypal";

describe("toCents", () => {
  it.each([
    ["15", 1500],
    ["15.5", 1550],
    ["15.50", 1550],
    ["0.99", 99],
    ["19.99", 1999],
  ] as [string, number][])("turns %s into %i cents", (value, cents) => {
    expect(toCents(value)).toBe(cents);
  });

  it.each(["-1", "1e3", "15.505", ""])("returns null for %s", (value) => {
    expect(toCents(value)).toBeNull();
  });

  it("returns null for null", () => {
    expect(toCents(null)).toBeNull();
  });
});

describe("paypalCheckoutUrl", () => {
  function checkoutUrl(itemName = "Buy me AI tokens", amountCents = 1500) {
    return new URL(
      paypalCheckoutUrl({
        email: "maker@example.com",
        amountCents,
        itemName,
        donationId: "don-1",
        notifyUrl: "https://example.com/api/paypal/ipn",
        returnUrl: "https://example.com/maker?paid=paypal",
        cancelUrl: "https://example.com/maker",
      }),
    );
  }

  it("points at PayPal's webscr endpoint", () => {
    const url = checkoutUrl();

    expect(`${url.origin}${url.pathname}`).toBe("https://www.paypal.com/cgi-bin/webscr");
    expect(url.searchParams.get("cmd")).toBe("_xclick");
  });

  it("sets business, amount, currency_code, custom and notify_url", () => {
    const url = checkoutUrl();

    expect(url.searchParams.get("business")).toBe("maker@example.com");
    expect(url.searchParams.get("amount")).toBe("15.00");
    expect(url.searchParams.get("currency_code")).toBe("USD");
    expect(url.searchParams.get("custom")).toBe("don-1");
    expect(url.searchParams.get("notify_url")).toBe("https://example.com/api/paypal/ipn");
  });

  it("formats the amount with two decimals", () => {
    expect(checkoutUrl("Buy me AI tokens", 99).searchParams.get("amount")).toBe("0.99");
    expect(checkoutUrl("Buy me AI tokens", 1550).searchParams.get("amount")).toBe("15.50");
  });

  it("sets the return and cancel urls", () => {
    const url = checkoutUrl();

    expect(url.searchParams.get("return")).toBe("https://example.com/maker?paid=paypal");
    expect(url.searchParams.get("cancel_return")).toBe("https://example.com/maker");
  });

  it("cuts item_name to 127 characters", () => {
    const url = checkoutUrl("x".repeat(200));

    expect(url.searchParams.get("item_name")).toBe("x".repeat(127));
  });
});
