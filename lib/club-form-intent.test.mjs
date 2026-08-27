import assert from "node:assert/strict";
import test from "node:test";
import { shouldCreateClub } from "./club-form-intent.ts";

test("only an explicit create action on the banner step submits a club", () => {
  assert.equal(shouldCreateClub("details", "create-club"), false);
  assert.equal(shouldCreateClub("details", ""), false);
  assert.equal(shouldCreateClub("banner", ""), false);
  assert.equal(shouldCreateClub("banner", "create-club"), true);
});
