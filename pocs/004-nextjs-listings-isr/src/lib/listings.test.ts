import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Listing } from "./types.ts";

const listings: Listing[] = JSON.parse(
  readFileSync(new URL("../data/listings.json", import.meta.url), "utf8"),
);

test("every listing id is unique and URL-safe (used by generateStaticParams)", () => {
  const ids = listings.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});
