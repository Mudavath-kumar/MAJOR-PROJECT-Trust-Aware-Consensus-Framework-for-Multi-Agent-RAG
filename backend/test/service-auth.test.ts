import test from "node:test";
import assert from "node:assert/strict";
import { hasValidServiceToken } from "../src/utils/service-auth.js";

test("accepts only an exact configured internal service token", () => {
  assert.equal(hasValidServiceToken("service-secret", "service-secret"), true);
  assert.equal(hasValidServiceToken("wrong-secret", "service-secret"), false);
  assert.equal(hasValidServiceToken(undefined, "service-secret"), false);
  assert.equal(hasValidServiceToken("service-secret", ""), false);
});

