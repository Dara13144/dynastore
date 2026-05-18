#!/usr/bin/env node
// Scans every src/**/*.{ts,tsx} file for `@/components/...` imports and
// verifies each imported name is actually exported by the target module.
// Fails (exit 1) with a human-readable report when any import is stale.
// This is a belt-and-braces check on top of `tsc --noEmit` so missing
// named exports surface as a dedicated CI failure with a clear message.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const ROOT = resolve(process.cwd(), "src");
const ALIAS_ROOT = resolve(process.cwd(), "src");

/** Recursively walk a directory yielding .ts/.tsx files. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      yield* walk(p);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      yield p;
    }
  }
}

/** Resolve `@/components/foo/bar` to an actual file on disk. */
function resolveAlias(importPath) {
  if (!importPath.startsWith("@/")) return null;
  const rel = importPath.slice(2);
  const base = join(ALIAS_ROOT, rel);
  const candidates = [
    base + ".tsx",
    base + ".ts",
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

/** Parse `export` declarations from a TS file and return the set of names. */
function readExports(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = readFileSync(file, "utf8");
  const names = new Set();
  // export { a, b as c }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}\s*(?:from\s*["']([^"']+)["'])?/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const as = t.match(/\bas\s+([A-Za-z_$][\w$]*)/);
      const name = as ? as[1] : t.split(/\s+/)[0];
      if (name) names.add(name);
    }
  }
  // export const/let/var/function/class/enum/interface/type Name
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:const|let|var|function\*?|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1]);
  }
  // export default ... → 'default'
  if (/export\s+default\b/.test(src)) names.add("default");
  // export * from "./x" → re-exports — pull in their named exports
  for (const m of src.matchAll(/export\s*\*\s*from\s*["']([^"']+)["']/g)) {
    const target = resolveSpec(m[1], dirname(file));
    if (target) for (const n of readExports(target, seen)) names.add(n);
  }
  return names;
}

function resolveSpec(spec, fromDir) {
  if (spec.startsWith("@/")) return resolveAlias(spec);
  if (spec.startsWith(".")) {
    const base = resolve(fromDir, spec);
    const candidates = [
      base + ".tsx",
      base + ".ts",
      join(base, "index.tsx"),
      join(base, "index.ts"),
    ];
    for (const c of candidates) if (existsSync(c)) return c;
  }
  return null;
}

const problems = [];
const importRe =
  /import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]+)\}|\*\s+as\s+[A-Za-z_$][\w$]*|([A-Za-z_$][\w$]*))?\s*from\s*["'](@\/components\/[^"']+)["']/g;

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(importRe)) {
    const [, defaultBefore, named, defaultAlone, spec] = m;
    const target = resolveAlias(spec);
    if (!target) {
      problems.push(`${file}: cannot resolve import path "${spec}"`);
      continue;
    }
    const exports = readExports(target);
    const wanted = [];
    if (defaultBefore) wanted.push({ name: defaultBefore, kind: "default" });
    if (defaultAlone) wanted.push({ name: defaultAlone, kind: "default" });
    if (named) {
      for (const part of named.split(",")) {
        const t = part.trim().replace(/^type\s+/, "");
        if (!t) continue;
        const as = t.split(/\s+as\s+/);
        wanted.push({ name: as[0].trim(), kind: "named" });
      }
    }
    for (const w of wanted) {
      const key = w.kind === "default" ? "default" : w.name;
      if (!exports.has(key)) {
        problems.push(
          `${file}: "${w.name}" is not exported from "${spec}" (resolved → ${target})`,
        );
      }
    }
  }
}

if (problems.length) {
  console.error(`✗ Stale @/components imports detected (${problems.length}):\n`);
  for (const p of problems) console.error("  - " + p);
  console.error(
    "\nFix: either add the missing export to the target module, or update the import.",
  );
  process.exit(1);
}

console.log("✓ All @/components imports resolve to real exports.");
