export type AgentExecutionView = {
  name: string;
  role: string;
  model: string | null;
  latencyMs: number | null;
  propositions: string[];
};

export type ChatScoreSignals = {
  decision: number | null;
  agentAgreement: number | null;
  retrievalSimilarity: number | null;
};

export type EvidencePresentation = {
  id: string;
  docId: string;
  docName: string;
  index: number;
  page: number | null;
  text: string;
  similarity: number | null;
  matchQuality: "high" | "medium" | "low" | "unknown";
};

export type ChatDisplayState = "idle" | "pending" | "error" | "answer" | "partial" | "abstain";

export function getChatErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

export function hasMatchingEvidence(citationIndex: number, evidenceCount: number): boolean {
  return Number.isInteger(citationIndex) && citationIndex > 0 && citationIndex <= evidenceCount;
}

export function mapEvidenceSources(value: unknown): EvidencePresentation[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry: unknown, index: number) => {
    const source = asRecord(entry);
    const similarity = finiteNumber(source.similarity_score);
    const validSimilarity =
      similarity !== null && similarity >= 0 && similarity <= 1 ? similarity : null;
    const page = finiteNumber(source.page_number);

    return {
      id: cleanString(source.chunk_id) ?? `evidence-${index}`,
      docId: cleanString(source.document_id) ?? "",
      docName: cleanString(source.document_name) ?? "Unknown source",
      index,
      page: page !== null && Number.isInteger(page) && page > 0 ? page : null,
      text: cleanString(source.text) ?? "",
      similarity: validSimilarity,
      matchQuality:
        validSimilarity === null
          ? "unknown"
          : validSimilarity >= 0.8
            ? "high"
            : validSimilarity >= 0.6
              ? "medium"
              : "low",
    };
  });
}

export function resolveChatDisplayState(input: {
  pending: boolean;
  hasError: boolean;
  decision?: unknown;
}): ChatDisplayState {
  if (input.pending) return "pending";
  if (input.hasError) return "error";
  if (input.decision === "answer" || input.decision === "partial" || input.decision === "abstain") {
    return input.decision;
  }
  return "idle";
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function percent(value: number | null, ratio = false): number | null {
  if (value === null) return null;
  const scaled = ratio ? value * 100 : value;
  return Math.round(Math.min(100, Math.max(0, scaled)) * 10) / 10;
}

function displayAgentName(value: unknown): string {
  const name = (cleanString(value) ?? "consensus_agent").toLowerCase().replace(/[\s-]+/g, "_");
  if (name.includes("retriever") || name.includes("researcher")) return "Retriever";
  if (name.includes("fact_checker") || name.includes("verifier")) return "Fact checker";
  if (name.includes("critic")) return "Critic auditor";
  if (name.includes("trust")) return "Source trust assessor";
  if (name.includes("reason")) return "Reasoner";
  return "Consensus agent";
}

export function mapAgentExecutions(value: unknown): AgentExecutionView[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry: unknown) => {
    const execution = asRecord(entry);
    const latency = finiteNumber(execution.latency_ms);
    const propositions = Array.isArray(execution.claim_propositions)
      ? execution.claim_propositions
          .map(cleanString)
          .filter((claim): claim is string => claim !== null)
      : [];

    return {
      name: displayAgentName(execution.agent_name),
      role: cleanString(execution.agent_role) ?? "Recorded pipeline role",
      model: cleanString(execution.model_used),
      latencyMs: latency !== null && latency >= 0 ? latency : null,
      propositions,
    };
  });
}

export function mapChatScores(input: {
  confidenceScore?: unknown;
  consensus?: unknown;
  evaluationMatrix?: unknown;
}): ChatScoreSignals {
  const consensus = asRecord(input.consensus);
  const scoreComponents = asRecord(consensus.score_components);
  const evaluation = asRecord(input.evaluationMatrix ?? consensus.evaluation_matrix);

  const decisionScore =
    finiteNumber(consensus.decision_score) ??
    finiteNumber(consensus.consensus_score) ??
    finiteNumber(input.confidenceScore);
  const agreementRatio = finiteNumber(consensus.agreement_ratio);
  const retrievalSimilarity =
    finiteNumber(evaluation.context_precision) ?? finiteNumber(scoreComponents.retrieval_quality);

  return {
    decision: percent(decisionScore, decisionScore !== null && decisionScore <= 1),
    agentAgreement: percent(agreementRatio, agreementRatio !== null && agreementRatio <= 1),
    retrievalSimilarity: percent(
      retrievalSimilarity,
      evaluation.context_precision === undefined &&
        retrievalSimilarity !== null &&
        retrievalSimilarity <= 1,
    ),
  };
}

export function formatSourcePage(value: unknown): string {
  const page = finiteNumber(value);
  return page !== null && Number.isInteger(page) && page > 0 ? `Page ${page}` : "Page unavailable";
}
