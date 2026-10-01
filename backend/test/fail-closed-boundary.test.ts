import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("AI gateway has no embedded answer or ingestion fallback", () => {
  const source = readFileSync(resolve(root, "src/services/ai.service.ts"), "utf8");
  assert.equal(source.includes("embedded Node.js AI engine"), false);
  assert.equal(source.includes("Deterministic heuristic synthesis fallback"), false);
  assert.equal(source.includes("Fall through to embedded"), false);
});

test("document storage has no silent local-only upload path", () => {
  const source = readFileSync(resolve(root, "src/services/storage.service.ts"), "utf8");
  assert.equal(source.includes("softUpload"), false);
  assert.equal(source.includes('return "local-only"'), false);
});

