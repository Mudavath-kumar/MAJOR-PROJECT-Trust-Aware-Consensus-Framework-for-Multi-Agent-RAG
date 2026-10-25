import test from "node:test";
import assert from "node:assert/strict";
import {
  auditResearchBenchmarkData,
  getResearchBenchmarkRecord,
  loadResearchBenchmark,
} from "../src/services/research-benchmark.js";

test("fixed v4 candidate passes its integrity audit and exposes exact composition", async () => {
  const benchmark = await loadResearchBenchmark();

  assert.equal(benchmark.datasetVersion, "trustrag-public-candidate-v4");
  assert.deepEqual(benchmark.audit.composition, {
    answerable: 100,
    unanswerable: 50,
    conflicting: 25,
    prompt_injection: 25,
  });
  assert.equal(benchmark.records.length, 200);
  assert.deepEqual(benchmark.audit.findings, []);
  assert.match(benchmark.audit.sourceSha256, /^[a-f0-9]{64}$/);
});

test("record detail separates HotpotQA source facts from synthetic challenge documents", async () => {
  const conflict = await getResearchBenchmarkRecord("q-0151");
  assert.equal(conflict.source?.answer, "1200000 oilbbl/d");
  assert.deepEqual(conflict.reviewBlockers, []);
  assert.ok(conflict.documents.some((document) => document.synthetic && /synthetic-conflict/.test(document.path)));
  assert.ok(conflict.documents.some((document) => !document.synthetic && document.evidenceIds.length > 0));
  await assert.rejects(() => getResearchBenchmarkRecord("../../outside"), /not found/i);
});

test("audit rejects a record set with duplicate IDs or altered composition", async () => {
  const benchmark = await loadResearchBenchmark();
  const duplicated = [...benchmark.records];
  duplicated[1] = { ...duplicated[1], id: duplicated[0].id };

  const result = auditResearchBenchmarkData({ ...benchmark, records: duplicated });

  assert.ok(result.findings.some((finding) => /duplicate/i.test(finding)));
});

test("audit rejects corpus content that does not match the manifest snapshot hash", async () => {
  const benchmark = await loadResearchBenchmark();
  const corrupted = {
    ...benchmark,
    corpusDocuments: benchmark.corpusDocuments.map((document, index) =>
      index === 0 ? { ...document, text: `${document.text}tampered` } : document,
    ),
  };

  const result = auditResearchBenchmarkData(corrupted);

  assert.ok(result.findings.some((finding) => /hash|snapshot/i.test(finding)));
});

test("audit rejects manifest evidence IDs or chunk hashes that do not match source text", async () => {
  const benchmark = await loadResearchBenchmark();
  const alteredManifest = {
    ...benchmark,
    corpusManifest: {
      ...benchmark.corpusManifest,
      sources: benchmark.corpusManifest.sources.map((source, index) => index === 0
        ? { ...source, chunks: [{ ...(source.chunks as Array<Record<string, unknown>>)[0], text_sha256: "0".repeat(64) }] }
        : source),
    },
  };

  const result = auditResearchBenchmarkData(alteredManifest);

  assert.ok(result.findings.some((finding) => /chunk text hashes/i.test(finding)));
});

test("audit detects a source snapshot path that escapes the fixed corpus root", async () => {
  const benchmark = await loadResearchBenchmark();
  const escaped = {
    ...benchmark,
    corpusDocuments: benchmark.corpusDocuments.map((document, index) =>
      index === 0 ? { ...document, relativePath: "../../outside.md" } : document,
    ),
  };

  const result = auditResearchBenchmarkData(escaped);

  assert.ok(result.findings.some((finding) => /path/i.test(finding)));
});
