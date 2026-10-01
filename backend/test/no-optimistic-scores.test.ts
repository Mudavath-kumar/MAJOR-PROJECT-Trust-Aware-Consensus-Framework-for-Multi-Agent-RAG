import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const backendRoot = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(backendRoot, relativePath), "utf8");

test("persisted evaluation defaults are fail-closed", () => {
  const agent = read("src/models/AgentExecution.ts");
  const consensus = read("src/models/ConsensusResult.ts");
  const evidence = read("src/controllers/evidence.controller.ts");

  assert.doesNotMatch(agent, /default:\s*0\.94/);
  assert.doesNotMatch(consensus, /default:\s*92|default:\s*0\.93|default:\s*["']reached["']/);
  assert.doesNotMatch(evidence, /\|\|\s*90|\|\|\s*0\.9|answer_relevance:\s*92|:\s*94;/);
});
