import { describe, expect, it } from "vitest";
import { isLocalDatabaseHost, mayApplySchema } from "../src/lib/db";

const REMOTE = "postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
const LOCAL = "postgres://postgres:postgres@localhost:5432/buymeatokens";

describe("isLocalDatabaseHost", () => {
  it.each(["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "host.docker.internal", "db", "postgres"])(
    "treats %s as local",
    (host) => expect(isLocalDatabaseHost(host)).toBe(true),
  );

  it.each([
    "aws-0-us-east-1.pooler.supabase.com",
    "db.example.com",
    "10.0.0.5",
    "192.168.1.20",
    "2a05:d014::1",
    "127.0.0.1.nip.io",
    "localhost.example.com",
  ])("treats %s as remote", (host) => expect(isLocalDatabaseHost(host)).toBe(false));
});

describe("mayApplySchema", () => {
  it("lets a developer machine migrate only a local database", () => {
    expect(mayApplySchema(LOCAL, { NODE_ENV: "development" })).toBe(true);
    expect(mayApplySchema(REMOTE, { NODE_ENV: "development" })).toBe(false);
    expect(mayApplySchema(REMOTE, {})).toBe(false); // scripts run without NODE_ENV
    expect(mayApplySchema(REMOTE, { NODE_ENV: "test" })).toBe(false);
  });

  it("refuses a remote database during a local `next build`", () => {
    expect(mayApplySchema(REMOTE, { NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(false);
    expect(mayApplySchema(LOCAL, { NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(true);
  });

  it("lets deployments and production servers migrate their own database", () => {
    expect(mayApplySchema(REMOTE, { VERCEL: "1", NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(true);
    expect(mayApplySchema(REMOTE, { VERCEL: "1", NODE_ENV: "production" })).toBe(true);
    expect(mayApplySchema(REMOTE, { NODE_ENV: "production" })).toBe(true); // next start on your own server
  });

  it("allows a remote database only with the explicit opt-in", () => {
    expect(mayApplySchema(REMOTE, { NODE_ENV: "development", ALLOW_REMOTE_SCHEMA: "1" })).toBe(true);
    expect(mayApplySchema(REMOTE, { NODE_ENV: "development", ALLOW_REMOTE_SCHEMA: "true" })).toBe(false);
  });
});
