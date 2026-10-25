import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const REVIEW_CANDIDATE_VERSION = "trustrag-public-candidate-v4";
export const REVIEW_AUDIT_VERSION = "trustrag-review-consistency-v1";
const cwd = path.resolve(process.cwd());
const PROJECT_ROOT = existsSync(path.join(cwd, "experiments/datasets", REVIEW_CANDIDATE_VERSION))
  ? cwd
  : path.resolve(cwd, "..");
const DATA_ROOT = path.join(PROJECT_ROOT, "experiments/datasets", REVIEW_CANDIDATE_VERSION);
const DATASET_PATH = path.join(DATA_ROOT, "trustrag-project-draft.jsonl");
const MANIFEST_PATH = path.join(DATA_ROOT, "trustrag-v1.manifest.json");
const SOURCE_PATH = path.join(PROJECT_ROOT, "experiments/datasets/hotpot-validation-sampled-200.source.json");
const fixedCorpusRoot = () => path.resolve(DATA_ROOT, "corpus");

type SourceRow = {
  id: string;
  question: string;
  answer: string;
  context: { title: string[]; sentences: string[][] };
  supporting_facts: { title: string[]; sent_id: number[] };
};

export type ResearchRecord = {
  id: string;
  dataset_version: string;
  question: string;
  answer_type: "answerable" | "unanswerable" | "conflicting" | "prompt_injection";
  gold_answer: string;
  gold_evidence_ids: string[];
  documents: Array<{ document_id: string; snapshot_sha256: string }>;
  challenge: { intervention: string; synthetic: true } | null;
  source_dataset: { license: string; name: string; record_id: string; split: string };
  review: Record<string, unknown>;
};

export type CorpusDocument = {
  document_id: string;
  relativePath: string;
  snapshotSha256: string;
  text: string;
  chunks: Array<{ evidence_id: string; chunk_index: number; start_word: number; word_count: number; text_sha256: string }>;
};

export type ResearchBenchmarkData = {
  datasetVersion: string;
  records: ResearchRecord[];
  sourceRows: SourceRow[];
  corpusManifest: { dataset_version: string; sources: Array<Record<string, unknown>> };
  corpusDocuments: CorpusDocument[];
  sourceSha256: string;
  candidateSha256: string;
  manifestSha256: string;
};

export type ResearchBenchmarkAudit = {
  version: string;
  status: "passed" | "failed";
  composition: Record<string, number>;
  findings: string[];
  sourceSha256: string;
  candidateSha256: string;
  manifestSha256: string;
  auditSha256: string;
};

export class ResearchBenchmarkIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchBenchmarkIntegrityError";
  }
}

export class ResearchBenchmarkNotFoundError extends Error {
  constructor(recordId: string) {
    super(`Research benchmark record not found: ${recordId}`);
    this.name = "ResearchBenchmarkNotFoundError";
  }
}

let benchmarkCache: Promise<ResearchBenchmarkData & { audit: ResearchBenchmarkAudit }> | null = null;

const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const normalize = (value: string) => value.normalize("NFKC").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");

async function readFixedData(): Promise<ResearchBenchmarkData> {
  const [candidateText, manifestText, sourceText] = await Promise.all([
    readFile(DATASET_PATH, "utf8"),
    readFile(MANIFEST_PATH, "utf8"),
    readFile(SOURCE_PATH, "utf8"),
  ]);
  const records = candidateText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as ResearchRecord);
  const corpusManifest = JSON.parse(manifestText) as ResearchBenchmarkData["corpusManifest"];
  const sourceSnapshot = JSON.parse(sourceText) as { rows?: SourceRow[] };
  if (!Array.isArray(sourceSnapshot.rows)) throw new ResearchBenchmarkIntegrityError("Source snapshot has no rows array");

  const resolvedRoot = fixedCorpusRoot();
  const corpusDocuments: CorpusDocument[] = await Promise.all(
    corpusManifest.sources.map(async (entry) => {
      const relativePath = String(entry.path ?? "");
      const fullPath = path.resolve(PROJECT_ROOT, relativePath);
      if (!fullPath.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new ResearchBenchmarkIntegrityError(`Corpus path escapes the fixed dataset root: ${relativePath}`);
      }
      const text = await readFile(fullPath, "utf8");
      return {
        document_id: String(entry.document_id),
        relativePath,
        snapshotSha256: String(entry.snapshot_sha256),
        text,
        chunks: Array.isArray(entry.chunks)
          ? entry.chunks.map((chunk: any) => ({
              evidence_id: String(chunk.evidence_id),
              chunk_index: Number(chunk.chunk_index),
              start_word: Number(chunk.start_word),
              word_count: Number(chunk.word_count),
              text_sha256: String(chunk.text_sha256),
            }))
          : [],
      };
    }),
  );

  return {
    datasetVersion: REVIEW_CANDIDATE_VERSION,
    records,
    sourceRows: sourceSnapshot.rows,
    corpusManifest,
    corpusDocuments,
    sourceSha256: sha256(sourceText),
    candidateSha256: sha256(candidateText),
    manifestSha256: sha256(manifestText),
  };
}

function sourceSupportFacts(source: SourceRow): string[] {
  const titles = source.supporting_facts?.title ?? [];
  const sentenceIds = source.supporting_facts?.sent_id ?? [];
  return titles.flatMap((title, index) => {
    const paragraphIndex = source.context.title.findIndex((candidate) => normalize(candidate) === normalize(title));
    const sentence = source.context.sentences[paragraphIndex]?.[sentenceIds[index]];
    return typeof sentence === "string" && sentence.trim() ? [sentence.trim()] : [];
  });
}

export function auditResearchBenchmarkData(data: ResearchBenchmarkData): ResearchBenchmarkAudit {
  const findings: string[] = [];
  const composition: Record<string, number> = {};
  const expected = { answerable: 100, unanswerable: 50, conflicting: 25, prompt_injection: 25 };
  const recordIds = new Set<string>();
  const sourceIds = new Set(data.sourceRows.map((row) => row.id));
  if (data.sourceRows.length !== 200 || sourceIds.size !== data.sourceRows.length) findings.push("Frozen HotpotQA source snapshot must contain 200 unique record IDs");
  const sources = new Map(data.corpusManifest.sources.map((source) => [String(source.document_id), source]));
  const documents = new Map(data.corpusDocuments.map((document) => [document.document_id, document]));
  const evidenceIds = new Set(data.corpusManifest.sources.flatMap((source: any) => (source.chunks ?? []).map((chunk: any) => String(chunk.evidence_id))));
  const sourceById = new Map(data.sourceRows.map((row) => [row.id, row]));

  if (data.records.length !== 200) findings.push(`Expected 200 records, found ${data.records.length}`);
  for (const record of data.records) {
    composition[record.answer_type] = (composition[record.answer_type] ?? 0) + 1;
    if (recordIds.has(record.id)) findings.push(`Duplicate record ID ${record.id}`);
    recordIds.add(record.id);
    if (record.dataset_version !== data.corpusManifest.dataset_version) findings.push(`${record.id}: dataset version mismatch`);
    if (!record.source_dataset || record.source_dataset.name !== "HotpotQA" || record.source_dataset.license !== "CC BY-SA 4.0") findings.push(`${record.id}: missing HotpotQA provenance or CC BY-SA 4.0 license`);
    if (sourceIds.has(record.source_dataset?.record_id) === false) findings.push(`${record.id}: source row is not in the frozen snapshot`);
    const source = sourceById.get(record.source_dataset?.record_id);
    const expectedAnswer = record.answer_type === "answerable" || record.answer_type === "prompt_injection" ? source?.answer ?? "" : "";
    if (source && (normalize(record.question) !== normalize(source.question) || normalize(record.gold_answer) !== normalize(expectedAnswer))) findings.push(`${record.id}: question or answer differs from source labels`);
    if (record.review?.reviewer_a !== "pending" || record.review?.reviewer_b !== "pending" || record.review?.resolution !== "pending") findings.push(`${record.id}: candidate contains a pre-approved review label`);

    const scopedDocs: CorpusDocument[] = [];
    for (const reference of record.documents ?? []) {
      const sourceDoc = sources.get(reference.document_id) as any;
      const document = documents.get(reference.document_id);
      if (!sourceDoc || !document) {
        findings.push(`${record.id}: references an unknown corpus document`);
        continue;
      }
      if (reference.snapshot_sha256 !== sourceDoc.snapshot_sha256 || document.snapshotSha256 !== sourceDoc.snapshot_sha256) findings.push(`${record.id}: document snapshot hash mismatch`);
      if (String(sourceDoc.path) !== document.relativePath) findings.push(`${record.id}: manifest path does not match the loaded corpus document`);
      const fixedCorpusPrefix = `experiments/datasets/${REVIEW_CANDIDATE_VERSION}/corpus/${record.id}-`;
      const resolvedDocumentPath = path.resolve(PROJECT_ROOT, document.relativePath);
      if (!document.relativePath.startsWith(fixedCorpusPrefix) || !resolvedDocumentPath.startsWith(`${fixedCorpusRoot()}${path.sep}`)) findings.push(`${record.id}: corpus path is outside this record's scope`);
      if (sha256(document.text) !== sourceDoc.snapshot_sha256) findings.push(`${record.id}: corpus file hash mismatch`);
      if (!record.documents.some((item) => item.document_id === reference.document_id)) findings.push(`${record.id}: corpus scope mismatch`);
      const words = document.text.replace(/\s+/g, " ").trim().split(" ");
      const expectedChunks = words[0]
        ? Array.from({ length: Math.ceil(words.length / 320) }, (_, chunkIndex) => {
            const startWord = chunkIndex * 320;
            const chunkWords = words.slice(startWord, startWord + 400);
            return {
              evidence_id: `${document.document_id}:chunk_${chunkIndex + 1}_${startWord}`,
              chunk_index: chunkIndex,
              start_word: startWord,
              word_count: chunkWords.length,
              text_sha256: sha256(chunkWords.join(" ")),
            };
          })
        : [];
      const manifestChunks = Array.isArray(sourceDoc.chunks) ? sourceDoc.chunks.map((chunk: any) => ({
        evidence_id: String(chunk.evidence_id),
        chunk_index: Number(chunk.chunk_index),
        start_word: Number(chunk.start_word),
        word_count: Number(chunk.word_count),
        text_sha256: String(chunk.text_sha256),
      })) : [];
      if (JSON.stringify(manifestChunks) !== JSON.stringify(expectedChunks)) findings.push(`${record.id}: manifest evidence IDs or chunk text hashes do not match the corpus file`);
      scopedDocs.push(document);
    }

    const trustedDocs = scopedDocs.filter((document) => !/synthetic-(?:conflict|injection)/i.test(document.relativePath));
    const syntheticDocs = scopedDocs.filter((document) => /synthetic-(?:conflict|injection)/i.test(document.relativePath));
    const expectedDocumentCount = record.answer_type === "conflicting" || record.answer_type === "prompt_injection" ? 2 : 1;
    if (scopedDocs.length !== expectedDocumentCount) findings.push(`${record.id}: unexpected number of scoped documents`);
    for (const evidenceId of record.gold_evidence_ids ?? []) {
      if (!evidenceIds.has(evidenceId)) findings.push(`${record.id}: unknown evidence ID ${evidenceId}`);
      if (!scopedDocs.some((document) => document.chunks.some((chunk) => chunk.evidence_id === evidenceId))) findings.push(`${record.id}: evidence ID is outside the record scope`);
    }
    const supportFacts = source ? sourceSupportFacts(source) : [];
    if (source && supportFacts.length !== source.supporting_facts.sent_id.length) findings.push(`${record.id}: source supporting facts cannot be resolved`);
    const trustedText = normalize(trustedDocs.map((document) => document.text).join("\n"));
    const factsPresent = supportFacts.map((fact) => trustedText.includes(normalize(fact)));
    if ((record.answer_type === "answerable" || record.answer_type === "conflicting" || record.answer_type === "prompt_injection") && (!supportFacts.length || factsPresent.some((present) => !present))) findings.push(`${record.id}: trusted corpus is missing annotated supporting facts`);
    if (record.answer_type === "unanswerable" && factsPresent.some(Boolean)) findings.push(`${record.id}: unanswerable scope still contains an annotated supporting fact`);

    if (record.answer_type === "conflicting") {
      const synthetic = syntheticDocs.find((document) => /synthetic-conflict/i.test(document.relativePath));
      const sourceAnswer = source?.answer ?? "";
      const deniedAnswer = normalize(sourceAnswer) === "yes" ? "no" : normalize(sourceAnswer) === "no" ? "yes" : `not ${sourceAnswer}`;
      if (!record.challenge?.synthetic || !synthetic || !normalize(synthetic.text).includes(normalize(`Synthetic alternative claim: the answer is ${deniedAnswer}.`))) findings.push(`${record.id}: synthetic conflict does not directly contradict the source answer`);
    }
    if (record.answer_type === "prompt_injection") {
      const synthetic = syntheticDocs.find((document) => /synthetic-injection/i.test(document.relativePath));
      if (!record.challenge?.synthetic || !synthetic || !normalize(synthetic.text).includes("untrusted document instruction")) findings.push(`${record.id}: prompt injection fixture is missing or not marked synthetic`);
    }
    if ((record.answer_type === "answerable" || record.answer_type === "unanswerable") && syntheticDocs.length) findings.push(`${record.id}: unexpected synthetic challenge document`);
  }
  for (const [answerType, expectedCount] of Object.entries(expected)) {
    if (composition[answerType] !== expectedCount) findings.push(`Expected ${expectedCount} ${answerType} records, found ${composition[answerType] ?? 0}`);
  }

  const auditSha256 = sha256([data.sourceSha256, data.candidateSha256, data.manifestSha256, REVIEW_AUDIT_VERSION, ...findings].join("\n"));
  return {
    version: REVIEW_AUDIT_VERSION,
    status: findings.length ? "failed" : "passed",
    composition,
    findings,
    sourceSha256: data.sourceSha256,
    candidateSha256: data.candidateSha256,
    manifestSha256: data.manifestSha256,
    auditSha256,
  };
}

export function getReviewBlockers(record: ResearchRecord, documents: CorpusDocument[]): string[] {
  const syntheticEvidence = new Set(
    documents
      .filter((document) => /synthetic-(?:conflict|injection)/i.test(document.relativePath))
      .flatMap((document) => document.chunks.map((chunk) => chunk.evidence_id)),
  );
  if (record.answer_type === "conflicting" && record.gold_evidence_ids.some((id) => syntheticEvidence.has(id))) {
    return ["A synthetic conflict chunk is labeled as gold evidence. Correct the candidate in a new dataset version before approval."];
  }
  return [];
}

export async function loadResearchBenchmark(): Promise<ResearchBenchmarkData & { audit: ResearchBenchmarkAudit }> {
  if (!benchmarkCache) {
    benchmarkCache = readFixedData().then((data) => {
      const audit = auditResearchBenchmarkData(data);
      if (audit.status !== "passed") throw new ResearchBenchmarkIntegrityError(`Fixed benchmark failed integrity audit: ${audit.findings.slice(0, 8).join("; ")}`);
      return { ...data, audit };
    }).catch((error) => {
      benchmarkCache = null;
      if (error instanceof ResearchBenchmarkIntegrityError) throw error;
      const message = error instanceof Error ? error.message : "unknown dataset loading error";
      throw new ResearchBenchmarkIntegrityError(`Fixed benchmark data is unavailable or invalid: ${message}`);
    });
  }
  return benchmarkCache;
}

export async function getResearchBenchmarkRecord(recordId: string) {
  const benchmark = await loadResearchBenchmark();
  const record = benchmark.records.find((candidate) => candidate.id === recordId);
  if (!record) throw new ResearchBenchmarkNotFoundError(recordId);
  const source = benchmark.sourceRows.find((row) => row.id === record.source_dataset.record_id);
  const scoped = record.documents.map((reference) => {
    const document = benchmark.corpusDocuments.find((candidate) => candidate.document_id === reference.document_id)!;
    return {
      documentId: document.document_id,
      path: document.relativePath,
      text: document.text,
      synthetic: /synthetic-(?:conflict|injection)/i.test(document.relativePath),
      evidenceIds: document.chunks.map((chunk) => chunk.evidence_id),
    };
  });
  const scopedCorpusDocuments = benchmark.corpusDocuments.filter((document) =>
    record.documents.some((reference) => reference.document_id === document.document_id),
  );
  return {
    record,
    source: source ? {
      question: source.question,
      answer: source.answer,
      supportingFacts: sourceSupportFacts(source),
      supportingFactTitles: source.supporting_facts.title,
    } : null,
    documents: scoped,
    reviewBlockers: getReviewBlockers(record, scopedCorpusDocuments),
    audit: benchmark.audit,
  };
}
