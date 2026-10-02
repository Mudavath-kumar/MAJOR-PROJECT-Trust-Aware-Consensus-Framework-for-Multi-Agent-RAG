import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

test("backend preserves the evidence-gated decision contract", () => {
  const service = read("src/services/ai.service.ts");
  const controller = read("src/controllers/chat.controller.ts");
  const consensus = read("src/models/ConsensusResult.ts");
  const evidence = read("src/controllers/evidence.controller.ts");

  for (const field of ["decision_status", "decision_score", "abstention_reason", "score_components"]) {
    assert.match(service, new RegExp(field));
    assert.match(controller, new RegExp(field));
    assert.match(consensus, new RegExp(field));
    assert.match(evidence, new RegExp(field));
  }
});

test("backend keeps the legacy consensus status for deployed clients", () => {
  const controller = read("src/controllers/chat.controller.ts");

  assert.match(controller, /consensusStatusRaw/);
  assert.match(controller, /consensusStatusRaw\s*===\s*"reached"/);
  assert.match(controller, /status:\s*consensusStatus/);
});
