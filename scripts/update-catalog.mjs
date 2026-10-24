import { readFile, writeFile } from "node:fs/promises";
import {
  bundledCatalog,
  fetchCatalog,
  parseCatalog,
} from "../src/lib/template-catalog.ts";
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--from"))
  throw new Error(
    "Usage: node scripts/update-catalog.mjs [--from catalog.json]",
  );
const catalog = args.length
  ? parseCatalog(JSON.parse(await readFile(args[1], "utf8")))
  : await fetchCatalog();
if (catalog.repository !== bundledCatalog.repository)
  throw new Error("Unexpected template publisher");
await writeFile(
  new URL("../src/data/template-catalog.json", import.meta.url),
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  `Updated ${catalog.templates.length} public template entries; no subscriptions involved.`,
);
