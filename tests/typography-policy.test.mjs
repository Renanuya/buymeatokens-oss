import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkTypography, typographyViolations } from "../scripts/check-typography.mjs";

describe("typography policy", () => {
  it.each([
    '<h2 className="text-[11px] uppercase tracking-[0.14em]">About</h2>',
    '<p className="sm:uppercase">About</p>',
    '.label { @apply text-xs uppercase tracking-wide; }',
    '.label { text-transform: uppercase; }',
    '<p style={{ textTransform: "uppercase" }}>About</p>',
    '<p style="text-transform:UPPERCASE">About</p>',
    '<text text-transform="uppercase">About</text>',
  ])("rejects the prohibited treatment: %s", (source) => {
    expect(typographyViolations(source)).toHaveLength(1);
  });

  it("allows sentence-case headings, acronyms and data normalization", () => {
    expect(typographyViolations(`
      <h2 className="text-2xl font-semibold tracking-tight">Where the tokens go</h2>
      <span>USDC</span>
      const currency = value.toUpperCase();
    `)).toEqual([]);
  });

  it("checks nested UI, emails and public assets, without reading credentials or generated files", () => {
    const root = mkdtempSync(join(tmpdir(), "typography-policy-"));
    try {
      for (const directory of ["src/components", "src/lib", "public", ".next", "node_modules"]) {
        mkdirSync(join(root, directory), { recursive: true });
      }
      writeFileSync(join(root, "src/components/heading.tsx"), '<h2 className="uppercase">About</h2>');
      writeFileSync(join(root, "src/lib/email.ts"), '\n<p style="text-transform:uppercase">Welcome</p>');
      writeFileSync(join(root, "public/badge.svg"), '<text text-transform="uppercase">Support</text>');
      for (const path of [".env.local", ".next/output.js", "node_modules/dependency.js"]) {
        writeFileSync(join(root, path), "uppercase");
      }
      const violations = checkTypography(root);
      expect(violations).toHaveLength(3);
      expect(violations.some((violation) => /email\.ts:2:/.test(violation))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
