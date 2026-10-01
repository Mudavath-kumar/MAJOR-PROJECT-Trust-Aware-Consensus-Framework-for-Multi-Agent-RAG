import test from "node:test";
import assert from "node:assert/strict";
import { hasValidServiceToken } from "../src/utils/service-auth.js";
import { normalizeServiceUrl } from "../src/config/environment.js";

test("accepts only an exact configured internal service token", () => {
  assert.equal(hasValidServiceToken("service-secret", "service-secret"), true);
  assert.equal(hasValidServiceToken("wrong-secret", "service-secret"), false);
  assert.equal(hasValidServiceToken(undefined, "service-secret"), false);
  assert.equal(hasValidServiceToken("service-secret", ""), false);
});

test("normalizes Render hostport values to private HTTP URLs", () => {
  assert.equal(normalizeServiceUrl("trustrag-ai-service.internal:8000"), "http://trustrag-ai-service.internal:8000");
  assert.equal(normalizeServiceUrl("https://trustrag-ai-service.onrender.com"), "https://trustrag-ai-service.onrender.com");
});

