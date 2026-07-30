export type DocStatus = "ready" | "processing" | "failed";

export type TrustDoc = {
  id: string;
  name: string;
  type: "PDF" | "DOCX" | "TXT" | "MD";
  size: string;
  chunks: number;
  uploaded: string;
  status: DocStatus;
  trust: number;
  tags: string[];
};

export const DOCUMENTS: TrustDoc[] = [
  { id: "d1", name: "clinical-trial-phase-iii.pdf", type: "PDF", size: "4.2 MB", chunks: 318, uploaded: "2 hours ago", status: "ready", trust: 94, tags: ["research", "medical"] },
  { id: "d2", name: "q3-financial-report.pdf", type: "PDF", size: "1.8 MB", chunks: 142, uploaded: "6 hours ago", status: "ready", trust: 91, tags: ["finance"] },
  { id: "d3", name: "security-policy.docx", type: "DOCX", size: "620 KB", chunks: 58, uploaded: "Yesterday", status: "ready", trust: 88, tags: ["policy"] },
  { id: "d4", name: "architecture-notes.md", type: "MD", size: "94 KB", chunks: 27, uploaded: "Yesterday", status: "processing", trust: 0, tags: ["engineering"] },
  { id: "d5", name: "customer-interviews.txt", type: "TXT", size: "310 KB", chunks: 76, uploaded: "3 days ago", status: "ready", trust: 79, tags: ["research"] },
  { id: "d6", name: "vendor-agreement-2026.pdf", type: "PDF", size: "2.1 MB", chunks: 164, uploaded: "5 days ago", status: "ready", trust: 85, tags: ["legal"] },
];

export const CHUNKS = [
  {
    id: "c1",
    doc: "clinical-trial-phase-iii.pdf",
    page: 42,
    similarity: 0.94,
    trust: "high" as const,
    text: "Across the 1,204-patient cohort, the treatment arm demonstrated a 31% reduction in relapse events over 18 months (p < 0.001), with adverse events comparable to placebo.",
    highlight: "31% reduction in relapse events",
  },
  {
    id: "c2",
    doc: "clinical-trial-phase-iii.pdf",
    page: 57,
    similarity: 0.88,
    trust: "high" as const,
    text: "Secondary endpoints confirmed durability of response at the 24-month follow-up, though the sample retained was reduced to 862 participants.",
    highlight: "durability of response at the 24-month follow-up",
  },
  {
    id: "c3",
    doc: "customer-interviews.txt",
    page: 3,
    similarity: 0.71,
    trust: "medium" as const,
    text: "Clinicians repeatedly asked for a citation trail before they would act on any model output, describing unsourced answers as 'unusable in practice'.",
    highlight: "citation trail before they would act",
  },
  {
    id: "c4",
    doc: "security-policy.docx",
    page: 11,
    similarity: 0.62,
    trust: "low" as const,
    text: "All derived datasets must retain provenance metadata for a minimum of seven years following the study close-out date.",
    highlight: "retain provenance metadata",
  },
];

export const AGENT_STEPS = [
  { key: "retrieve", label: "Retrieving documents", detail: "18 candidate chunks scanned across 6 sources" },
  { key: "research", label: "Research agent", detail: "Drafted a grounded outline from top-8 chunks" },
  { key: "verify", label: "Fact verification", detail: "7 of 7 claims matched to source text" },
  { key: "trust", label: "Trust assessment", detail: "Source authority and recency weighted" },
  { key: "reason", label: "Reasoning", detail: "Resolved a conflict between p.42 and p.57" },
  { key: "consensus", label: "Consensus engine", detail: "3 agents agreed, 0 dissent" },
  { key: "final", label: "Final response", detail: "Answer assembled with citations" },
];

export const ANSWER = `The Phase III trial reports a **31% reduction in relapse events** over 18 months across a 1,204-patient cohort, with statistical significance at *p < 0.001* [1].

Durability held at the 24-month follow-up, but note the retained sample dropped to 862 participants, so the long-horizon estimate carries wider uncertainty [2].

Practical implication: clinicians in your interview set said they will not act on model output without a visible citation trail [3] — so surface these sources inline in any downstream product.`;

export const ACTIVITY = [
  { who: "Research agent", what: "verified 7 claims on relapse reduction", when: "2m ago" },
  { who: "You", what: "uploaded clinical-trial-phase-iii.pdf", when: "2h ago" },
  { who: "Consensus engine", what: "flagged 1 low-agreement answer", when: "4h ago" },
  { who: "Embedding worker", what: "indexed 318 chunks", when: "5h ago" },
  { who: "You", what: "adjusted consensus threshold to 0.72", when: "Yesterday" },
];

export const CONFIDENCE_DIST = [
  { bucket: "0-20", value: 3 },
  { bucket: "20-40", value: 8 },
  { bucket: "40-60", value: 21 },
  { bucket: "60-80", value: 64 },
  { bucket: "80-100", value: 118 },
];

export const TRUST_DIST = [
  { name: "High", value: 142 },
  { name: "Medium", value: 58 },
  { name: "Low", value: 14 },
];

export const QUERIES_PER_DAY = [
  { day: "Mon", queries: 48, docs: 3 },
  { day: "Tue", queries: 61, docs: 5 },
  { day: "Wed", queries: 74, docs: 2 },
  { day: "Thu", queries: 58, docs: 6 },
  { day: "Fri", queries: 96, docs: 4 },
  { day: "Sat", queries: 32, docs: 1 },
  { day: "Sun", queries: 27, docs: 2 },
];

export const LATENCY = [
  { day: "Mon", p50: 1.2, p95: 3.1 },
  { day: "Tue", p50: 1.1, p95: 2.8 },
  { day: "Wed", p50: 1.4, p95: 3.6 },
  { day: "Thu", p50: 1.0, p95: 2.4 },
  { day: "Fri", p50: 1.3, p95: 3.0 },
  { day: "Sat", p50: 0.9, p95: 2.1 },
  { day: "Sun", p50: 0.9, p95: 2.0 },
];

export const HALLUCINATION = [
  { week: "W1", rate: 4.1 },
  { week: "W2", rate: 3.4 },
  { week: "W3", rate: 2.6 },
  { week: "W4", rate: 1.9 },
  { week: "W5", rate: 1.4 },
  { week: "W6", rate: 1.1 },
];