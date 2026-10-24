import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const base = new URL(process.argv[2] || "invalid:");
assert(
  base.protocol === "https:" ||
    (base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname)),
  "Provide the HTTPS deployment URL (or a local static preview URL)",
);
assert(!base.username && !base.password && !base.search && !base.hash);
assert.equal(base.pathname, "/");
const directory = new URL("../dist/client/", import.meta.url);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const files = [];
for (const path of await readdir(directory, { recursive: true })) {
  if ((await stat(new URL(path, directory))).isFile()) files.push(path);
}
assert(files.includes("index.html"), "Build static files before verifying a deployment");

async function verify(path) {
  const expected = hash(await readFile(new URL(path, directory)));
  const relative = path === "index.html" ? "" : path.split("/").map(encodeURIComponent).join("/");
  const url = new URL(relative, base);
  let failure;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
      assert.equal(hash(Buffer.from(await response.arrayBuffer())), expected, `${path}: content differs from the build`);
      return;
    } catch (error) {
      failure = error;
      if (attempt < 9) await delay(2000);
    }
  }
  throw failure;
}
await verify("index.html");
const assets = files.filter((path) => path !== "index.html");
for (let index = 0; index < assets.length; index += 4) {
  await Promise.all(assets.slice(index, index + 4).map(verify));
}
console.log(`Verified ${files.length} published files at ${base.href}; all hashes match this build.`);
