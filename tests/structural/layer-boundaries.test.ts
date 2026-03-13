/**
 * Structural Test: Layer Boundary Enforcement
 *
 * Harness Engineering P3 — Mechanical enforcement over documentation.
 * These tests validate the architectural dependency direction:
 *
 *   src/cap/          → (no internal deps, only zod)
 *   src/utils/        → (no internal deps)
 *   src/security/     → src/cap/
 *   src/transport/    → src/cap/ + src/security/ + src/utils/ + shared-types
 *
 * Violations here mean the architecture is drifting.
 */

import { describe, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "../../src");

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const importRegex = /from\s+["']([^"']+)["']/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]!);
  }
  return imports;
}

function getFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursive(full));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

function resolveRelativeImport(fromFile: string, importPath: string): string | null {
  if (!importPath.startsWith(".")) return null; // external dep
  const resolved = path.resolve(path.dirname(fromFile), importPath);
  // Get path relative to SRC_ROOT
  const relToSrc = path.relative(SRC_ROOT, resolved);
  // Extract top-level module
  return relToSrc.split(path.sep)[0] ?? null;
}

describe("Layer Boundaries", () => {
  it("src/cap/ has no internal deps (only external: zod)", () => {
    const files = getFilesRecursive(path.join(SRC_ROOT, "cap"));
    for (const file of files) {
      const imports = getImports(file);
      for (const imp of imports) {
        const mod = resolveRelativeImport(file, imp);
        if (mod && mod !== "cap") {
          throw new Error(
            `LAYER VIOLATION: ${path.relative(SRC_ROOT, file)} imports from ${mod}/. ` +
              `src/cap/ must only depend on external packages (zod) and itself.`
          );
        }
      }
    }
  });

  it("src/utils/ has no internal deps", () => {
    const files = getFilesRecursive(path.join(SRC_ROOT, "utils"));
    for (const file of files) {
      const imports = getImports(file);
      for (const imp of imports) {
        const mod = resolveRelativeImport(file, imp);
        if (mod && mod !== "utils") {
          throw new Error(
            `LAYER VIOLATION: ${path.relative(SRC_ROOT, file)} imports from ${mod}/. ` +
              `src/utils/ must have no internal dependencies.`
          );
        }
      }
    }
  });

  it("src/security/ only imports from cap/ and utils/", () => {
    const allowed = new Set(["security", "cap", "utils"]);
    const files = getFilesRecursive(path.join(SRC_ROOT, "security"));
    for (const file of files) {
      const imports = getImports(file);
      for (const imp of imports) {
        const mod = resolveRelativeImport(file, imp);
        if (mod && !allowed.has(mod)) {
          throw new Error(
            `LAYER VIOLATION: ${path.relative(SRC_ROOT, file)} imports from ${mod}/. ` +
              `src/security/ may only import from cap/ and utils/.`
          );
        }
      }
    }
  });

  it("src/transport/ only imports from cap/, security/, utils/, and transport/", () => {
    const allowed = new Set(["transport", "cap", "security", "utils", "config.js"]);
    const files = getFilesRecursive(path.join(SRC_ROOT, "transport"));
    for (const file of files) {
      const imports = getImports(file);
      for (const imp of imports) {
        const mod = resolveRelativeImport(file, imp);
        if (mod && !allowed.has(mod)) {
          throw new Error(
            `LAYER VIOLATION: ${path.relative(SRC_ROOT, file)} imports from ${mod}/. ` +
              `src/transport/ may only import from cap/, security/, utils/, and config.`
          );
        }
      }
    }
  });

  it("no file imports from transport/ except index.ts", () => {
    const allFiles = getFilesRecursive(SRC_ROOT).filter(
      (f) => !f.includes("/transport/") && !f.endsWith("index.ts")
    );
    for (const file of allFiles) {
      const imports = getImports(file);
      for (const imp of imports) {
        const mod = resolveRelativeImport(file, imp);
        if (mod === "transport") {
          throw new Error(
            `LAYER VIOLATION: ${path.relative(SRC_ROOT, file)} imports from transport/. ` +
              `Only index.ts may import transport/.`
          );
        }
      }
    }
  });
});
