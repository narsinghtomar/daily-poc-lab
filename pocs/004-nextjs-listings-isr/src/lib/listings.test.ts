import { test } from "node:test";
import assert from "node:assert/strict";
import { getListings, getListingById } from "./listings.ts";

test("returns all mock listings with unique ids", async () => {
  const all = await getListings();
  assert.ok(all.length > 0);
  assert.equal(new Set(all.map((l) => l.id)).size, all.length);
});

test("finds a listing by id and returns undefined for unknown ids", async () => {
  assert.equal((await getListingById("l-101"))?.city, "Pune");
  assert.equal(await getListingById("nope"), undefined);
});

test("returned listings are copies, not shared state", async () => {
  const [a] = await getListings();
  a.title = "mutated";
  const [b] = await getListings();
  assert.notEqual(b.title, "mutated");
});
