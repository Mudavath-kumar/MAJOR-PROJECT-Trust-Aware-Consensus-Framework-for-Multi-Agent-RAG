import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("frontend consumes the evidence-gated decision fields", () => {
  const chat = read("src/routes/app.chat.tsx");
  const client = read("src/lib/api-client.ts");
  const evaluations = read("src/routes/app.evaluations.tsx");

  assert.match(chat, /decision_status/);
  assert.match(chat, /decisionStatus/);
  assert.match(chat, /Abstained/);
  assert.match(chat, /Retrieval provenance/);
  assert.match(client, /decision_status/);
  assert.match(evaluations, /decision_status/);
  assert.match(evaluations, /Decision/);
});

test("frontend does not present retrieval similarity as factual trust", () => {
  const chat = read("src/routes/app.chat.tsx");

  assert.doesNotMatch(chat, /Trust score/);
  assert.doesNotMatch(chat, /trust:\s*.*agreement_ratio/);
});
