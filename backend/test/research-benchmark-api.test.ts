import test from "node:test";
import assert from "node:assert/strict";
import researchBenchmarkRoutes from "../src/routes/research-benchmark.routes.js";
import {
  prepareReviewedExport,
  validateNoReviewBlockers,
  validateReviewPayload,
  validateReviewTransition,
} from "../src/controllers/research-benchmark.controller.js";
import { loadResearchBenchmark } from "../src/services/research-benchmark.js";
import { authenticate } from "../src/middleware/auth.js";
import ResearchBenchmarkReview from "../src/models/ResearchBenchmarkReview.js";

test("research review router mounts authentication before its endpoints", async () => {
  assert.equal(researchBenchmarkRoutes.stack[0].handle, authenticate);
  let status = 0;
  let body: unknown;
  await authenticate(
    { headers: {} } as never,
    { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; return this; } } as never,
    () => assert.fail("unauthenticated request must not continue"),
  );
  assert.equal(status, 401);
  assert.deepEqual(body, { error: "Authentication required. Please log in." });
});

test("a flagged record cannot be approved against the same frozen candidate version", () => {
  assert.throws(() => validateReviewTransition("needs_correction", "approved"), /corrected candidate version/i);
  assert.doesNotThrow(() => validateReviewTransition("needs_correction", "needs_correction"));
  assert.doesNotThrow(() => validateReviewTransition("approved", "needs_correction"));
});

test("records with synthetic evidence mislabeled as gold cannot be approved", () => {
  assert.throws(() => validateNoReviewBlockers("approved", ["Synthetic challenge is mislabeled as gold evidence."]), /synthetic/i);
  assert.doesNotThrow(() => validateNoReviewBlockers("needs_correction", ["Synthetic challenge is mislabeled as gold evidence."]));
});

test("review persistence enforces the unique reviewer/version/record key and bounded decisions", async () => {
  const compoundIndex = ResearchBenchmarkReview.schema.indexes().find(([keys]) =>
    Object.keys(keys).join(",") === "user_id,dataset_version,record_id",
  );
  assert.equal(compoundIndex?.[1].unique, true);
  const review = new ResearchBenchmarkReview({
    user_id: "507f1f77bcf86cd799439011",
    dataset_version: "trustrag-public-candidate-v4",
    record_id: "q-0001",
    decision: "approved",
    notes: "x".repeat(2001),
  });
  await assert.rejects(review.validate(), /2000/);
});

test("review payload accepts only bounded decisions and requires correction notes", () => {
  assert.deepEqual(validateReviewPayload({ decision: "approved", notes: "Looks consistent", expectedUpdatedAt: null }), {
    decision: "approved",
    notes: "Looks consistent",
    expectedUpdatedAt: null,
  });
  assert.throws(() => validateReviewPayload({ decision: "needs_correction", notes: "   ", expectedUpdatedAt: null }), /note/i);
  assert.throws(() => validateReviewPayload({ decision: "approved; approvedAll", notes: "x", expectedUpdatedAt: null }), /decision/i);
  assert.throws(() => validateReviewPayload({ decision: "approved", notes: "x".repeat(2001), expectedUpdatedAt: null }), /2000/);
});

test("paper export requires every authenticated review decision and a fresh passing audit", async () => {
  const benchmark = await loadResearchBenchmark();
  const allApproved = benchmark.records.map((record) => ({
    record_id: record.id,
    decision: "approved" as const,
    notes: "Reviewed against source labels and scoped corpus.",
    updated_at: new Date("2026-10-25T00:00:00.000Z"),
  }));

  assert.throws(() => prepareReviewedExport(benchmark, allApproved.slice(0, -1)), /200/i);
  assert.throws(() => prepareReviewedExport(benchmark, allApproved.map((item, index) => index === 3 ? { ...item, decision: "needs_correction" as const } : item)), /approved/i);
  const conflict = benchmark.records.find((record) => record.answer_type === "conflicting")!;
  const syntheticEvidence = benchmark.corpusDocuments.find((document) =>
    conflict.documents.some((reference) => reference.document_id === document.document_id) && /synthetic-conflict/.test(document.relativePath),
  )!.chunks[0].evidence_id;
  const blockedBenchmark = {
    ...benchmark,
    records: benchmark.records.map((record) => record.id === conflict.id
      ? { ...record, gold_evidence_ids: [...record.gold_evidence_ids, syntheticEvidence] }
      : record),
  };
  assert.throws(() => prepareReviewedExport(blockedBenchmark, allApproved), /synthetic.*gold evidence/i);
  const exported = prepareReviewedExport(benchmark, allApproved);
  assert.equal(exported.length, 200);
  assert.equal(exported[0].review.review_protocol, "one-human-plus-automated");
  assert.equal(exported[0].review.human_reviewer_count, 1);
  assert.equal(exported[0].review.automated_audit.audit_sha256, benchmark.audit.auditSha256);
});
