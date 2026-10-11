import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSourcePage,
  getChatErrorMessage,
  hasMatchingEvidence,
  mapAgentExecutions,
  mapEvidenceSources,
  mapChatScores,
  resolveChatDisplayState,
} from "../src/lib/chat-presentation.ts";

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

test("keeps pending, backend errors, and answer decisions as separate display states", () => {
  assert.equal(resolveChatDisplayState({ pending: true, hasError: false }), "pending");
  assert.equal(resolveChatDisplayState({ pending: false, hasError: true }), "error");
  assert.equal(
    resolveChatDisplayState({ pending: false, hasError: false, decision: "answer" }),
    "answer",
  );
  assert.equal(
    resolveChatDisplayState({ pending: false, hasError: false, decision: "partial" }),
    "partial",
  );
  assert.equal(
    resolveChatDisplayState({ pending: false, hasError: false, decision: "abstain" }),
    "abstain",
  );
});

test("does not turn absent or malformed response metadata into an abstention", () => {
  assert.equal(resolveChatDisplayState({ pending: false, hasError: false }), "idle");
  assert.equal(
    resolveChatDisplayState({ pending: false, hasError: false, decision: "unknown" }),
    "idle",
  );
});

test("keeps a useful retry-safe message when a provider throws an empty error", () => {
  assert.equal(
    getChatErrorMessage(new Error("Gemini is unavailable"), "Request failed"),
    "Gemini is unavailable",
  );
  assert.equal(getChatErrorMessage(new Error("  "), "Request failed"), "Request failed");
  assert.equal(getChatErrorMessage("unexpected value", "Request failed"), "Request failed");
});

test("only links a citation when its returned evidence passage exists", () => {
  assert.equal(hasMatchingEvidence(1, 1), true);
  assert.equal(hasMatchingEvidence(2, 1), false);
  assert.equal(hasMatchingEvidence(0, 1), false);
  assert.equal(hasMatchingEvidence(1, 0), false);
});

test("does not invent zero similarity or page metadata for returned evidence", () => {
  assert.deepEqual(
    mapEvidenceSources([
      { chunk_id: "chunk-1", document_name: "Policy.pdf", page_number: 0, text: "Evidence" },
      { chunk_id: "chunk-2", similarity_score: 1.4, page_number: 2.5, text: "More evidence" },
    ]),
    [
      {
        id: "chunk-1",
        docId: "",
        docName: "Policy.pdf",
        index: 0,
        page: null,
        text: "Evidence",
        similarity: null,
        matchQuality: "unknown",
      },
      {
        id: "chunk-2",
        docId: "",
        docName: "Unknown source",
        index: 1,
        page: null,
        text: "More evidence",
        similarity: null,
        matchQuality: "unknown",
      },
    ],
  );
});
