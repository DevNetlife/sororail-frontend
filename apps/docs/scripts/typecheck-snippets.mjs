// Type-checks the TypeScript snippets in the docs against the SDK source.
// A snippet is checked only when it contains an import statement. Fragments
// that use variables set up elsewhere on the page are counted and skipped.
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(docsRoot, "../..");
const contentRoot = join(docsRoot, "src/content/docs");
const outDir = join(docsRoot, "node_modules/.cache/snippets");
const sdkEntry = join(repoRoot, "packages/sdk/src/index.ts");
const sdkNodeModules = join(repoRoot, "packages/sdk/node_modules");
const tsc = join(repoRoot, "node_modules/.bin/tsc");
const FENCE = /^```ts[^\n]*\n([\s\S]*?)^```/gm;

async function markdownFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(full)));
    else if (/\.mdx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

// Start from an empty output folder so removed snippets are not checked.
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const snippets = [];
let skipped = 0;
for (const file of await markdownFiles(contentRoot)) {
  const source = await readFile(file, "utf8");
  const page = relative(contentRoot, file).replace(/\W+/g, "_");
  let index = 0;
  for (const [, code] of source.matchAll(FENCE)) {
    if (!/^\s*import\s/m.test(code)) {
      skipped++;
      continue;
    }
    const name = `${page}_${++index}.ts`;
    await writeFile(join(outDir, name), code);
    snippets.push(name);
  }
}

if (snippets.length === 0) {
  console.log("No complete TypeScript snippets to check.");
  process.exit(0);
}

const tsconfig = join(outDir, "tsconfig.json");
await writeFile(
  tsconfig,
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM"],
        skipLibCheck: true,
        paths: {
          "@sororail/sdk": [sdkEntry],
          "*": [join(sdkNodeModules, "*")],
        },
      },
      files: snippets,
    },
    null,
    2,
  ),
);

console.log(`Checking ${snippets.length} snippet(s); skipped ${skipped} fragment(s) without an import.`);
const result = spawnSync(tsc, ["-p", tsconfig], { stdio: "inherit" });
process.exit(result.status ?? 1);
