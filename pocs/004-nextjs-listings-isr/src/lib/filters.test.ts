import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilters, parseFilters } from "./filters.ts";
import type { Listing } from "./types.ts";

const listings: Listing[] = [
  { id: "l-001", title: "A", city: "Berlin", type: "apartment", price: 1450, bedrooms: 2 },
  { id: "l-002", title: "B", city: "Berlin", type: "studio", price: 780, bedrooms: 0 },
  { id: "l-003", title: "C", city: "Hamburg", type: "house", price: 2600, bedrooms: 4 },
  { id: "l-004", title: "D", city: "Amsterdam", type: "apartment", price: 1600, bedrooms: 1 },
  { id: "l-005", title: "E", city: "Amsterdam", type: "apartment", price: 1900, bedrooms: 3 },
];

test("parseFilters drops invalid values", () => {
  assert.deepEqual(parseFilters({ type: "castle", maxPrice: "abc", bedrooms: "-1", city: " " }), {
    city: undefined,
    type: undefined,
    minBedrooms: undefined,
    maxPrice: undefined,
  });
});

test("parseFilters uses the first value of repeated params", () => {
  assert.equal(parseFilters({ city: ["Berlin", "Hamburg"] }).city, "Berlin");
});

test("no filters returns everything", () => {
  assert.equal(applyFilters(listings, parseFilters({})).length, listings.length);
});

test("city match is case-insensitive", () => {
  const r = applyFilters(listings, parseFilters({ city: "berlin" }));
  assert.ok(r.length > 0 && r.every((l) => l.city === "Berlin"));
});

test("filters combine with AND", () => {
  const r = applyFilters(listings, parseFilters({ city: "Amsterdam", type: "apartment", maxPrice: "1700" }));
  assert.deepEqual(r.map((l) => l.id), ["l-004"]);
});

test("minimum bedrooms is inclusive", () => {
  const r = applyFilters(listings, parseFilters({ bedrooms: "3" }));
  assert.ok(r.every((l) => l.bedrooms >= 3));
  assert.equal(r.length, 2);
});
