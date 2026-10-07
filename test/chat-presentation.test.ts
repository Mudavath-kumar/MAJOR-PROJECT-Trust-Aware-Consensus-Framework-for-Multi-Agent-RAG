import assert from "node:assert/strict";
import test from "node:test";
import { formatSourcePage, mapAgentExecutions, mapChatScores } from "../src/lib/chat-presentation";

test("restores persisted agent executions without claiming every agent verified", () => {
  const agents = mapAgentExecutions([
    {
      agent_name: "fact_checker",
      agent_role: "Factual Verification Specialist",
      model_used: "model-a",
      latency_ms: 42,
      claim_propositions: ["Claim supported by source 1", 17, ""],
    },
  ]);

  assert.deepEqual(agents, [
    {
      name: "Fact checker",
      role: "Factual Verification Specialist",
      model: "model-a",
      latencyMs: 42,
      propositions: ["Claim supported by source 1"],
    },
  ]);
});

test("separates the decision, agent agreement, and retrieval-similarity signals", () => {
  assert.deepEqual(
    mapChatScores({
      confidenceScore: 97.2,
      consensus: {
        decision_score: 0.972,
        consensus_score: 97.2,
        agreement_ratio: 0.875,
      },
      evaluationMatrix: { context_precision: 85.8 },
    }),
    { decision: 97.2, agentAgreement: 87.5, retrievalSimilarity: 85.8 },
  );
});

test("keeps missing score signals unmeasured instead of displaying zero", () => {
  assert.deepEqual(mapChatScores({}), {
    decision: null,
    agentAgreement: null,
    retrievalSimilarity: null,
  });
});

test("does not present the backend's missing-page sentinel as PDF page zero", () => {
  assert.equal(formatSourcePage(0), "Page unavailable");
  assert.equal(formatSourcePage(undefined), "Page unavailable");
  assert.equal(formatSourcePage(4), "Page 4");
});
