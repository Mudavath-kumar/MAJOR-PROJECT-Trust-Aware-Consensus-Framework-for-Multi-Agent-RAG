import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAnswerText, parseAnswerBlocks } from "../src/lib/answer-format";

test("removes internal claim metadata from a malformed persisted answer", () => {
  const raw =
    '"claim_id": "claim-1", "text": "TrustRAG retrieves document evidence and can abstain.", "evidence_ids": ["chunk-2-page-1"]';

  assert.equal(normalizeAnswerText(raw), "TrustRAG retrieves document evidence and can abstain.");
});

test("renders structured claim responses as answer prose", () => {
  const raw = JSON.stringify({
    claims: [
      {
        claim_id: "claim-1",
        text: "TrustRAG retrieves evidence [1].",
        evidence_ids: ["chunk-1"],
      },
    ],
  });

  assert.equal(normalizeAnswerText(raw), "TrustRAG retrieves evidence [1].");
});

test("keeps ordinary prose and numbered citations unchanged", () => {
  const answer = "The report describes an evidence gate and abstention [1].";

  assert.equal(normalizeAnswerText(answer), answer);
});

test("answer formatting removes markdown residue from headings and lists", () => {
  const blocks = parseAnswerBlocks(
    "# Executive Summary\n\nThe phrase is **amber-orbit-742**.\n\n- **Owner**: TrustRAG QA\n- **Source**: production fixture",
  );

  assert.deepEqual(blocks, [
    { type: "heading", level: 1, text: "Executive Summary" },
    { type: "paragraph", text: "The phrase is **amber-orbit-742**." },
    {
      type: "list",
      ordered: false,
      items: ["**Owner**: TrustRAG QA", "**Source**: production fixture"],
    },
  ]);
});

test("answer formatting keeps numbered citations available to the renderer", () => {
  const blocks = parseAnswerBlocks("The answer is supported by [1] and [2].");

  assert.deepEqual(blocks, [
    { type: "paragraph", text: "The answer is supported by [1] and [2]." },
  ]);
});
