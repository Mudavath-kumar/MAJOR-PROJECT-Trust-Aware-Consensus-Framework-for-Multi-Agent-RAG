import type { Response } from "express";
import { isDbConnected } from "../config/database.js";
import ResearchBenchmarkReview, { type ResearchReviewDecision } from "../models/ResearchBenchmarkReview.js";
import type { AuthRequest } from "../middleware/auth.js";
import {
  getResearchBenchmarkRecord,
  getReviewBlockers,
  loadResearchBenchmark,
  REVIEW_CANDIDATE_VERSION,
  ResearchBenchmarkIntegrityError,
  ResearchBenchmarkNotFoundError,
  type ResearchBenchmarkData,
} from "../services/research-benchmark.js";

const MAX_NOTES_LENGTH = 2000;
const PAGE_SIZE = 25;

export function validateReviewPayload(body: unknown): {
  decision: ResearchReviewDecision;
  notes: string;
  expectedUpdatedAt: string | null;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Review payload must be an object");
  const input = body as Record<string, unknown>;
  if (input.decision !== "approved" && input.decision !== "needs_correction") throw new Error("Invalid review decision");
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > MAX_NOTES_LENGTH) throw new Error(`Review notes cannot exceed ${MAX_NOTES_LENGTH} characters`);
  if (input.decision === "needs_correction" && !notes) throw new Error("A note is required when a record needs correction");
  if (!(input.expectedUpdatedAt === null || (typeof input.expectedUpdatedAt === "string" && Number.isFinite(Date.parse(input.expectedUpdatedAt))))) {
    throw new Error("expectedUpdatedAt must be an ISO timestamp or null");
  }
  return { decision: input.decision, notes, expectedUpdatedAt: input.expectedUpdatedAt };
}

export function validateReviewTransition(
  currentDecision: ResearchReviewDecision | undefined,
  nextDecision: ResearchReviewDecision,
): void {
  if (currentDecision === "needs_correction" && nextDecision === "approved") {
    throw new Error("This record was flagged. A corrected candidate version must be published and reviewed before approval.");
  }
}

export function validateNoReviewBlockers(
  decision: ResearchReviewDecision,
  blockers: string[],
): void {
  if (decision === "approved" && blockers.length) {
    throw new Error(blockers.join(" "));
  }
}

export function prepareReviewedExport(
  benchmark: ResearchBenchmarkData & { audit: Awaited<ReturnType<typeof loadResearchBenchmark>>["audit"] },
  reviews: Array<{ record_id: string; decision: ResearchReviewDecision; notes: string; updated_at: Date }>,
) {
  if (benchmark.audit.status !== "passed") throw new Error("Automated integrity audit has not passed");
  const byRecord = new Map(reviews.map((review) => [review.record_id, review]));
  if (byRecord.size !== benchmark.records.length || benchmark.records.some((record) => !byRecord.has(record.id))) {
    throw new Error("All 200 records must have a saved human review before export");
  }
  if (reviews.some((review) => review.decision !== "approved")) throw new Error("All 200 records must be approved before export");
  for (const record of benchmark.records) {
    const scopedDocuments = benchmark.corpusDocuments.filter((document) =>
      record.documents.some((reference) => reference.document_id === document.document_id),
    );
    const blockers = getReviewBlockers(record, scopedDocuments);
    if (blockers.length) throw new Error(`${record.id}: ${blockers.join(" ")}`);
  }
  return benchmark.records.map((record) => {
    const review = byRecord.get(record.id)!;
    return {
      ...record,
      review: {
        review_protocol: "one-human-plus-automated",
        human_reviewer_count: 1,
        human_review_status: "approved",
        reviewed_at: review.updated_at.toISOString(),
        automated_audit: {
          status: benchmark.audit.status,
          version: benchmark.audit.version,
          audit_sha256: benchmark.audit.auditSha256,
          source_sha256: benchmark.audit.sourceSha256,
          candidate_sha256: benchmark.audit.candidateSha256,
          manifest_sha256: benchmark.audit.manifestSha256,
        },
      },
    };
  });
}

function failUnavailable(res: Response) {
  if (isDbConnected()) return false;
  res.status(503).json({ error: "Database is unavailable; review progress cannot be loaded or saved." });
  return true;
}

function sendBenchmarkFailure(res: Response, error: unknown, message: string): void {
  if (error instanceof ResearchBenchmarkIntegrityError) {
    res.status(503).json({ error: error.message });
    return;
  }
  console.error(message, error);
  res.status(500).json({ error: message });
}

export async function listResearchBenchmark(req: AuthRequest, res: Response): Promise<void> {
  if (failUnavailable(res)) return;
  try {
    const benchmark = await loadResearchBenchmark();
    const userId = req.user!._id;
    const reviews = await ResearchBenchmarkReview.find({ user_id: userId, dataset_version: benchmark.datasetVersion }).lean();
    const reviewById = new Map(reviews.map((review) => [review.record_id, review]));
    const counts = { unreviewed: 0, approved: 0, needs_correction: 0 };
    for (const record of benchmark.records) {
      const decision = reviewById.get(record.id)?.decision as ResearchReviewDecision | undefined;
      if (decision === "approved") counts.approved += 1;
      else if (decision === "needs_correction") counts.needs_correction += 1;
      else counts.unreviewed += 1;
    }
    const typeFilter = req.query.type;
    const statusFilter = req.query.status;
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLocaleLowerCase() : "";
    const filtered = benchmark.records.filter((record) => {
      const review = reviewById.get(record.id);
      const state = review?.decision ?? "unreviewed";
      return (!typeFilter || typeFilter === record.answer_type)
        && (!statusFilter || statusFilter === state)
        && (!search || `${record.id} ${record.question}`.toLocaleLowerCase().includes(search));
    });
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((record) => {
      const review = reviewById.get(record.id);
      return {
        id: record.id,
        question: record.question,
        answerType: record.answer_type,
        status: review?.decision ?? "unreviewed",
        notes: review?.notes ?? "",
        updatedAt: review?.updated_at ?? null,
      };
    });
    res.json({
      dataset: { version: benchmark.datasetVersion, sourceDatasetVersion: benchmark.corpusManifest.dataset_version, total: benchmark.records.length },
      audit: { status: benchmark.audit.status, version: benchmark.audit.version, auditSha256: benchmark.audit.auditSha256, findings: benchmark.audit.findings },
      progress: { ...counts, total: benchmark.records.length },
      page: { number: page, size: PAGE_SIZE, total: filtered.length, pages: Math.ceil(filtered.length / PAGE_SIZE) },
      records: items,
    });
  } catch (error) {
    sendBenchmarkFailure(res, error, "Unable to load the fixed research benchmark.");
  }
}

export async function getResearchBenchmarkDetail(req: AuthRequest, res: Response): Promise<void> {
  if (failUnavailable(res)) return;
  const recordId = String(req.params.recordId);
  try {
    const detail = await getResearchBenchmarkRecord(recordId);
    const review = await ResearchBenchmarkReview.findOne({
      user_id: req.user!._id,
      dataset_version: REVIEW_CANDIDATE_VERSION,
      record_id: recordId,
    }).lean();
    res.json({ ...detail, review: review ? { decision: review.decision, notes: review.notes, updatedAt: review.updated_at } : null });
  } catch (error) {
    if (error instanceof ResearchBenchmarkNotFoundError) {
      res.status(404).json({ error: "Research benchmark record not found" });
      return;
    }
    sendBenchmarkFailure(res, error, "Unable to load this research benchmark record.");
  }
}

export async function saveResearchBenchmarkReview(req: AuthRequest, res: Response): Promise<void> {
  if (failUnavailable(res)) return;
  const recordId = String(req.params.recordId);
  let payload: ReturnType<typeof validateReviewPayload>;
  try {
    payload = validateReviewPayload(req.body);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid review payload" });
    return;
  }
  try {
    const benchmark = await loadResearchBenchmark();
    const record = benchmark.records.find((candidate) => candidate.id === recordId);
    if (!record) {
      res.status(404).json({ error: "Research benchmark record not found" });
      return;
    }
    const scopedDocuments = benchmark.corpusDocuments.filter((document) =>
      record.documents.some((reference) => reference.document_id === document.document_id),
    );
    try {
      validateNoReviewBlockers(payload.decision, getReviewBlockers(record, scopedDocuments));
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "This record needs a corrected dataset version." });
      return;
    }
    const filter = {
      user_id: req.user!._id,
      dataset_version: benchmark.datasetVersion,
      record_id: recordId,
    };
    const existing = await ResearchBenchmarkReview.findOne(filter);
    if (!existing && payload.expectedUpdatedAt !== null) {
      res.status(409).json({ error: "This review changed in another session. Reload the record before saving." });
      return;
    }
    if (existing && (!payload.expectedUpdatedAt || existing.updated_at.toISOString() !== new Date(payload.expectedUpdatedAt).toISOString())) {
      res.status(409).json({ error: "This review changed in another session. Reload the record before saving." });
      return;
    }
    try {
      validateReviewTransition(existing?.decision, payload.decision);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "A corrected candidate version is required." });
      return;
    }
    const writeFilter = existing ? { ...filter, _id: existing._id, updated_at: existing.updated_at } : filter;
    const saved = await ResearchBenchmarkReview.findOneAndUpdate(
      writeFilter,
      { $set: { decision: payload.decision, notes: payload.notes } },
      { new: true, upsert: !existing, runValidators: true, setDefaultsOnInsert: true },
    );
    if (!saved) {
      res.status(409).json({ error: "This review changed in another session. Reload the record before saving." });
      return;
    }
    res.json({ review: { decision: saved.decision, notes: saved.notes, updatedAt: saved.updated_at } });
  } catch (error: any) {
    if (error instanceof ResearchBenchmarkIntegrityError) {
      res.status(503).json({ error: error.message });
      return;
    }
    if (error?.code === 11000) {
      res.status(409).json({ error: "This review was saved in another session. Reload the record before saving." });
      return;
    }
    console.error("Research benchmark review save failed:", error);
    res.status(500).json({ error: "Unable to save this research benchmark review." });
  }
}

export async function exportResearchBenchmark(req: AuthRequest, res: Response): Promise<void> {
  if (failUnavailable(res)) return;
  try {
    const benchmark = await loadResearchBenchmark();
    const reviews = await ResearchBenchmarkReview.find({ user_id: req.user!._id, dataset_version: benchmark.datasetVersion }).lean();
    const records = prepareReviewedExport(benchmark, reviews as any);
    const jsonl = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${benchmark.datasetVersion}-reviewed.jsonl"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(jsonl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export reviewed dataset";
    if (error instanceof ResearchBenchmarkIntegrityError) {
      res.status(503).json({ error: message });
      return;
    }
    const gateError = /must have|must be approved|audit|blocker/i.test(message);
    res.status(gateError ? 409 : 500).json({ error: message });
  }
}
