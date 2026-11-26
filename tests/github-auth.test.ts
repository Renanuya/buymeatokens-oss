import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsertAuthUser: vi.fn(), claimGuestApplication: vi.fn(), enrollCreatorEmails: vi.fn(), sendCreatorWelcome: vi.fn(), after: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mocks.after }));
vi.mock("../src/lib/creator-emails", () => ({ enrollCreatorEmails: mocks.enrollCreatorEmails, sendCreatorWelcome: mocks.sendCreatorWelcome }));
vi.mock("../src/lib/users", () => ({ upsertAuthUser: mocks.upsertAuthUser }));
vi.mock("../src/lib/applications", () => ({ claimGuestApplication: mocks.claimGuestApplication }));
vi.mock("../src/lib/access", () => ({ homePathFor: () => "/dashboard" }));
vi.mock("../src/lib/session", () => ({
  sessionCookie: () => ({ name: "bmt_session", value: "test-session", options: { httpOnly: true } }),
}));

import { GET as startLogin } from "../src/app/api/auth/github/route";
import { GET as finishLogin } from "../src/app/api/auth/github/callback/route";

function callbackRequest(state = "test-state") {
  return new NextRequest(`https://example.com/api/auth/github/callback?code=test-code&state=${state}`, {
    headers: { cookie: "bmt_oauth_state=test-state" },
  });
}

describe("GitHub email collection", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://example.com");
    vi.stubEnv("GITHUB_CLIENT_ID", "test-client");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "test-secret");
    mocks.upsertAuthUser.mockReset().mockResolvedValue({ id: "user-1" });
    mocks.claimGuestApplication.mockReset().mockResolvedValue(null);
    mocks.enrollCreatorEmails.mockReset().mockResolvedValue(undefined);
    mocks.sendCreatorWelcome.mockReset().mockResolvedValue("sent");
    mocks.after.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function mockGithub(emails: Response | Error) {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/access_token")) return Response.json({ access_token: "test-token" });
      if (String(url).endsWith("/user")) {
        return Response.json({ id: 42, login: "maker", email: "public@example.com", name: "Maker" });
      }
      if (String(url).endsWith("/user/emails")) {
        if (emails instanceof Error) throw emails;
        return emails;
      }
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("requests only the email scope and keeps the state cookie", async () => {
    const res = await startLogin();
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("scope")).toBe("user:email");
    expect(location.searchParams.get("state")).toBe(res.cookies.get("bmt_oauth_state")?.value);
  });

  it("saves the verified primary address even when a different public address exists", async () => {
    mockGithub(Response.json([
      { email: "unverified@example.com", primary: true, verified: false },
      { email: "secondary@example.com", primary: false, verified: true },
      { email: "private-primary@example.com", primary: true, verified: true },
    ]));
    const res = await finishLogin(callbackRequest());
    expect(mocks.upsertAuthUser).toHaveBeenCalledWith(expect.objectContaining({
      authId: "github:42", email: "private-primary@example.com",
    }));
    expect(res.cookies.get("bmt_session")?.value).toBe("test-session");
  });

  it("does not save an unverified or secondary address", async () => {
    mockGithub(Response.json([
      { email: "unverified@example.com", primary: true, verified: false },
      { email: "secondary@example.com", primary: false, verified: true },
    ]));
    const res = await finishLogin(callbackRequest());
    expect(mocks.upsertAuthUser).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
    expect(res.headers.get("location")).toBe("https://example.com/dashboard");
  });

  it.each(["denied", "outage"])("continues login when email lookup has an %s", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGithub(failure === "denied" ? new Response(null, { status: 403 }) : new Error("Network unavailable"));
    const res = await finishLogin(callbackRequest());
    expect(mocks.upsertAuthUser).toHaveBeenCalledWith(expect.objectContaining({ email: null }));
    expect(res.cookies.get("bmt_session")?.value).toBe("test-session");
  });

  it("does not fetch or save emails when OAuth state is invalid", async () => {
    const fetchMock = mockGithub(Response.json([]));
    const res = await finishLogin(callbackRequest("invalid-state"));
    expect(res.headers.get("location")).toBe("https://example.com/login?error=oauth");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.upsertAuthUser).not.toHaveBeenCalled();
  });

  it("enrolls only the first registration and schedules its welcome after the login response", async () => {
    mockGithub(Response.json([{ email: "maker@example.com", primary: true, verified: true }]));
    mocks.upsertAuthUser.mockResolvedValueOnce({ id: "new-user", newlyCreated: true });
    const res = await finishLogin(callbackRequest());
    expect(res.headers.get("location")).toBe("https://example.com/dashboard");
    expect(mocks.enrollCreatorEmails).toHaveBeenCalledWith("new-user");
    expect(mocks.sendCreatorWelcome).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.sendCreatorWelcome).toHaveBeenCalledWith("new-user");
    await finishLogin(callbackRequest());
    expect(mocks.enrollCreatorEmails).toHaveBeenCalledTimes(1);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
});
