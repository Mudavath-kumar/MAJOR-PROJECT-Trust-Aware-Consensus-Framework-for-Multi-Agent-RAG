import test from "node:test";
import assert from "node:assert/strict";
import { serviceError } from "../src/services/ai.service.js";

test("preserves AI-service 503 as a dependency outage", () => {
  const error = serviceError("query", {
    response: {
      status: 503,
      data: { detail: "No LLM provider responded. Gemini HTTP 503; OpenRouter HTTP 402" },
    },
  });

  assert.equal((error as Error & { statusCode?: number }).statusCode, 503);
  assert.match(error.message, /No LLM provider responded/);
});

test("maps an AI-service request timeout to gateway timeout", () => {
  const error = serviceError("query", { code: "ECONNABORTED" });

  assert.equal((error as Error & { statusCode?: number }).statusCode, 504);
  assert.match(error.message, /AI service query is unavailable/);
});
