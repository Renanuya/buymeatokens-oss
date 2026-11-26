import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileMarkdown } from "../src/components/profile-markdown";
import { EarlySupporterBadge } from "../src/components/early-supporter-badge";
import { BIO_MAX_LENGTH, validateBio } from "../src/lib/profile";
import { validateUsername } from "../src/lib/validation";

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../src/lib/session", async () => {
  const { TERMS_VERSION } = await import("../src/lib/legal/config");
  return {
    requireCreator: async () => ({ id: "creator", username: "maker", termsVersion: TERMS_VERSION, termsAcceptedAt: 1, ageConfirmedAt: 1 }),
  };
});
vi.mock("../src/lib/users", () => ({ updateProfile: mocks.updateProfile }));
import { updateProfileAction } from "../src/app/dashboard/actions";

describe("creator description", () => {
  it("accepts 1,000 characters and rejects longer input without truncation or saving", async () => {
    expect(validateBio("")).toBeNull();
    expect(validateBio("x".repeat(BIO_MAX_LENGTH))).toBeNull();
    const form = new FormData();
    form.set("displayName", "Maker");
    form.set("price", "5");
    form.set("bio", "x".repeat(BIO_MAX_LENGTH + 1));
    expect((await updateProfileAction({}, form)).error).toContain("1,000");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    form.set("bio", "x".repeat(BIO_MAX_LENGTH));
    expect((await updateProfileAction({}, form)).message).toContain("Saved");
    expect(mocks.updateProfile).toHaveBeenCalledWith("creator", expect.objectContaining({ bio: "x".repeat(BIO_MAX_LENGTH) }));
  });

  it("preserves Markdown source when saving", async () => {
    const bio = "**Building** a [CLI](https://example.com).\n\n- AI tools\n- Open source";
    const form = new FormData();
    form.set("displayName", "Maker"); form.set("price", "5"); form.set("bio", bio);
    await updateProfileAction({}, form);
    expect(mocks.updateProfile).toHaveBeenLastCalledWith("creator", expect.objectContaining({ bio }));
  });

  it("renders headings, emphasis, links, lists and code", () => {
    const html = renderToStaticMarkup(<ProfileMarkdown>{"# Building\n\n**AI** and *tools*. [Project](https://example.com).\n\n- CLI\n- `code`"}</ProfileMarkdown>);
    expect(html).toContain("<h2>Building</h2>");
    expect(html).toContain("<strong>AI</strong>");
    expect(html).toContain("<em>tools</em>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("<li>CLI</li>");
    expect(html).toContain("<code>code</code>");
  });

  it("does not render raw HTML, scripts, unsafe links or remote images", () => {
    const html = renderToStaticMarkup(<ProfileMarkdown>{'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[unsafe](javascript:alert%281%29)\n\n![diagram](https://example.com/track.png)'}</ProfileMarkdown>);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("track.png");
    expect(html).toContain("diagram");
  });
});

describe("early supporter badge and roadmap", () => {
  it("shows a badge only for a creator with an earned lifetime benefit", () => {
    expect(renderToStaticMarkup(<EarlySupporterBadge grantedAt={null} />)).toBe("");
    const html = renderToStaticMarkup(<EarlySupporterBadge grantedAt={1_800_000_000_000} />);
    expect(html).toContain("Early supporter");
    expect(html).toContain('href="/about#lifetime-free"');
    expect(html).toContain("Joined as a creator during early access");
  });

  it("reserves the roadmap route against future username claims", () => {
    expect(validateUsername("roadmap")).toContain("reserved");
    expect(validateUsername("roadmap-maker")).toBeNull();
  });
});
