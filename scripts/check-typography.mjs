import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSIONS = new Set([".css", ".html", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".svg", ".mdx"]);

// Covers Tailwind utilities (including variants), CSS declarations, SVG attributes and React styles.
// Match a complete token so ordinary identifiers such as toUpperCase remain valid.
export function typographyViolations(source) {
  const violations = [];
  const forbidden = /(?<![\w-])uppercase(?![\w-])/gi;
  for (const match of source.matchAll(forbidden)) {
    const line = source.slice(0, match.index).split("\n").length;
    violations.push({ line, message: "Forced all-caps typography is banned; use sentence case and normal spacing." });
  }
  return violations;
}

export function checkTypography(root = ROOT) {
  const violations = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && EXTENSIONS.has(extname(entry.name))) {
        for (const violation of typographyViolations(readFileSync(path, "utf8"))) {
          violations.push(`${relative(root, path)}:${violation.line}: ${violation.message}`);
        }
      }
    }
  }
  // Only shipped sources and assets. Never inspect environment files, build output or dependencies.
  const directories = new Set(readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  for (const directory of ["src", "public", "assets", "content"]) {
    if (directories.has(directory)) visit(join(root, directory));
  }
  return violations;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const violations = checkTypography();
  if (violations.length) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Typography policy passed: no forced all-caps styling in shipped sources or assets.");
  }
}
