import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// src/lib is the framework-agnostic core. A lib module may import other lib
// modules, the domain types, and the packages allowlisted here — nothing else
// (no React, d3, components, theme or CSS).
const ALLOWED_PACKAGES = ["idb-keyval"];

const LIB = path.dirname(fileURLToPath(import.meta.url));
const TYPES = path.join(path.dirname(LIB), "types");

/** Every module specifier a source file imports or re-exports from. */
function importsOf(source: string): string[] {
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g, // import … from "x", export … from "x"
    /\bimport\s*["']([^"']+)["']/g, // import "x"
    /\bimport\s*\(\s*["']([^"']+)["']/g, // import("x")
  ];
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1]));
}

function isAllowed(file: string, spec: string): boolean {
  if (!spec.startsWith(".")) return ALLOWED_PACKAGES.includes(spec);
  const target = path.resolve(path.dirname(file), spec);
  return target === TYPES || target.startsWith(LIB + path.sep);
}

describe("src/lib import boundary", () => {
  it("finds imports in every form", () => {
    const source = [
      'import { a } from "./a";',
      'import type { B } from "../types";',
      'import {\n  c,\n} from "pkg-c";',
      'import "pkg-d";',
      'export * from "./e";',
      'const f = await import("pkg-f");',
    ].join("\n");
    expect(importsOf(source).sort()).toEqual(
      ["../types", "./a", "./e", "pkg-c", "pkg-d", "pkg-f"].sort(),
    );
  });

  it("allows only lib, types and the allowlisted packages", () => {
    const file = path.join(LIB, "example.ts");
    expect(isAllowed(file, "./dates")).toBe(true);
    expect(isAllowed(file, "../types")).toBe(true);
    expect(isAllowed(file, "idb-keyval")).toBe(true);
    expect(isAllowed(file, "../theme")).toBe(false);
    expect(isAllowed(file, "../components/BrandMark")).toBe(false);
    expect(isAllowed(file, "react")).toBe(false);
    expect(isAllowed(file, "d3")).toBe(false);
  });

  it("no lib module imports from outside lib, types or the allowlist", () => {
    const files = readdirSync(LIB, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.join(LIB, f));
    expect(files.length).toBeGreaterThan(0);

    const violations = files.flatMap((file) =>
      importsOf(readFileSync(file, "utf8"))
        .filter((spec) => !isAllowed(file, spec))
        .map((spec) => `${path.relative(LIB, file)} imports "${spec}"`),
    );
    expect(violations).toEqual([]);
  });
});
