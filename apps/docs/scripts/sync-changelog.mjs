// Copies the SDK changelog into the docs as a page. Runs before dev and build,
// so the page always matches packages/sdk/CHANGELOG.md. The output is generated
// and gitignored.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../../packages/sdk/CHANGELOG.md");
const target = resolve(here, "../src/content/docs/changelog.md");

const raw = await readFile(source, "utf8");
// The page title comes from the frontmatter, so drop the file's own top-level heading.
const body = raw.replace(/^#\s+.*\r?\n/, "").trimStart();

const page = [
  "---",
  "title: Changelog",
  "description: Release notes for @sororail/sdk.",
  "---",
  "",
  "<!-- Generated from packages/sdk/CHANGELOG.md by scripts/sync-changelog.mjs. Do not edit. -->",
  "",
  body,
].join("\n");

await mkdir(dirname(target), { recursive: true });
await writeFile(target, page);
console.log(`Wrote ${target}`);
