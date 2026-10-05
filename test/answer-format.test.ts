import assert from "node:assert/strict";
import test from "node:test";
import { parseAnswerBlocks } from "../src/lib/answer-format";

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
