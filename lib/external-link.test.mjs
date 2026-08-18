import assert from "node:assert/strict";
import test from "node:test";
import { isValidExternalHttpUrl } from "./external-link.ts";

test("accepts complete HTTP(S) URLs with domains and subdomains", () => {
  assert.equal(isValidExternalHttpUrl("https://register.example.edu/events/42"), true);
  assert.equal(isValidExternalHttpUrl("http://example.com"), true);
});

test("rejects URLs missing protocol syntax or a complete domain", () => {
  for (const value of [
    "register.example.edu/events/42",
    "https:/register.example.edu/events/42",
    "https://registration",
    "https://-register.example.edu",
    "javascript://register.example.edu",
  ]) {
    assert.equal(isValidExternalHttpUrl(value), false, value);
  }
});
