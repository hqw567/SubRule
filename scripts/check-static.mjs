import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const directory = new URL("dist/client/", root);
const config = JSON.parse(await readFile(new URL("wrangler.jsonc", root), "utf8"));
assert.equal(config.assets.directory, "./dist/client");
assert.equal(config.assets.not_found_handling, "single-page-application");
assert.equal(config.main, undefined, "The deployment must not contain a Worker entry");
assert.equal(config.assets.run_worker_first, undefined);

const html = await readFile(new URL("index.html", directory), "utf8");
assert.match(html, /<title>SubWeave/);
assert.match(html, /<script\b/);
assert.match(html, /订阅转换/);
for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)[^"]*"/g)) {
  await access(new URL(match[1].slice(1), directory));
}
const files = await readdir(directory, { recursive: true });
assert(!files.some((name) => /(^|\/)(?:_worker\.js|functions)(\/|$)/.test(name)));
for (const name of files.filter((name) => /\.(?:html|js)$/.test(name))) {
  const content = await readFile(new URL(name, directory), "utf8");
  assert.doesNotMatch(content, /\/api\/shorten|sub\.ffq\.la/);
}
console.log("Verified prerendered homepage, local assets and a static-only deployment.");
