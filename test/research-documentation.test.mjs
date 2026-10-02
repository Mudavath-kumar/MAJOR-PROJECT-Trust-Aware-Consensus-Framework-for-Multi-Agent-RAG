import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("research documentation describes the actual runtime and decision vocabulary", () => {
  const scope = read("docs/research-scope.md");
  const guide = read("BACKEND_AI_GUIDE.md");

  for (const term of [
    "MongoDB Atlas Vector Search",
    "word-window chunking",
    "provenance heuristic",
    "answer",
    "partial",
    "abstain",
  ]) {
    assert.match(`${scope}\n${guide}`, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("active architecture documentation does not advertise unused runtime components", () => {
  const approaches = read("APPROACHES.md");
  assert.doesNotMatch(approaches, /ChromaDB|BGE embeddings|Ollama|LangGraph/);
  assert.match(approaches, /tenant-scoped keyword-overlap/);
  assert.match(approaches, /deterministic provenance heuristic/);
});
