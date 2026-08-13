import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSelection } from "./mind-snap.ts";

test("a full selection advances after correct and wrong answers", () => {
  assert.equal(evaluateSelection(new Set([1, 2]), new Set([1, 2]), 3).nextLevel, 4);
  assert.deepEqual(evaluateSelection(new Set([1, 4]), new Set([1, 2]), 3), {
    result: { correct: 1, total: 2, wrong: 1, solved: false },
    nextLevel: 4,
  });
});
