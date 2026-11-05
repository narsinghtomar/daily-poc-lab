import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSaved, serializeSaved, setSaved } from "./saved.ts";

test("parseSaved drops invalid ids and duplicates", () => {
  assert.deepEqual(parseSaved("a-1,b-2,a-1,<x>,,B"), ["a-1", "b-2"]);
  assert.deepEqual(parseSaved(undefined), []);
});

test("setSaved adds and removes without mutating or duplicating", () => {
  const start = ["a"];
  assert.deepEqual(setSaved(start, "b", true), ["a", "b"]);
  assert.deepEqual(setSaved(["a", "b"], "b", true), ["a", "b"]);
  assert.deepEqual(setSaved(["a", "b"], "a", false), ["b"]);
  assert.deepEqual(start, ["a"]);
});

test("serialize round-trips through parse", () => {
  const ids = ["x-1", "y-2"];
  assert.deepEqual(parseSaved(serializeSaved(ids)), ids);
});
