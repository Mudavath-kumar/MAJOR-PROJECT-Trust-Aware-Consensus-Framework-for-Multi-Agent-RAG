import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  Filter,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiClient } from "@/lib/api-client";
import { MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/evaluations")({
  head: () => ({
    meta: [
      { title: "Evaluations & Audit Trail — TrustRAG Console" },
      {
        name: "description",
        content:
          "Enterprise-grade RAG evaluation matrix — Faithfulness, Context Precision, Answer Relevance, Hallucination Risk, and Consensus Alignment for every AI query.",
      },
      { property: "og:title", content: "TrustRAG Evaluations & Audit" },
    ],
  }),
  component: EvaluationsPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvaluationMatrix {
  faithfulness?: number;
  context_precision?: number;
  answer_relevance?: number;
  hallucination_risk?: "low" | "medium" | "high";
  composite_confidence?: number;
  consensus_alignment?: number;
}

interface AuditRecord {
  id: string;
  conversation_id: string;
  query: string;
  answer: string;
  confidence_score: number;
  consensus_status: string;
  consensus_score: number;
  evaluation_matrix: EvaluationMatrix;
  sources_count: number;
  created_at: string;
}

interface AuditSummary {
  total_evaluations: number;
  avg_faithfulness: number;
  avg_context_precision: number;
  avg_answer_relevance: number;
  hallucination_free_rate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const scoreColor = (v?: number): string => {
  if (v === undefined || v === null) return "text-muted-foreground";
  if (v >= 85) return "text-emerald-400";
  if (v >= 65) return "text-amber-400";
  return "text-red-400";
};

const scoreBg = (v?: number): string => {
  if (v === undefined || v === null) return "bg-muted/40";
  if (v >= 85) return "bg-emerald-500/10 border-emerald-500/20";
  if (v >= 65) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
};

const riskIcon = (risk?: string) => {
  switch (risk) {
    case "low":
      return <ShieldCheck size={13} className="text-emerald-400" />;
    case "medium":
      return <ShieldAlert size={13} className="text-amber-400" />;
    case "high":
      return <XCircle size={13} className="text-red-400" />;
    default:
      return <Shield size={13} className="text-muted-foreground" />;
  }
};

const riskBadge = (risk?: string): string => {
  switch (risk) {
    case "low":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "medium":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    case "high":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    default:
      return "text-muted-foreground bg-muted/40";
  }
};

const ScoreBar = ({ value, label }: { value?: number; label: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs font-semibold tabular-nums", scoreColor(value))}>
        {value !== undefined ? `${value}%` : "—"}
      </span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700",
          value !== undefined && value >= 85
            ? "bg-emerald-500"
            : value !== undefined && value >= 65
              ? "bg-amber-500"
              : "bg-red-500",
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </div>
  </div>
);

// ─── Metric Card ─────────────────────────────────────────────────────────────

const MetricCard = ({
  icon: Icon,
  label,
  value,
  unit = "%",
  color = "text-accent",
  description,
}: {
  icon: typeof Shield;
  label: string;
  value: number | string;
  unit?: string;
  color?: string;
  description: string;
}) => (
  <Panel className="animate-rise p-5">
    <div className="flex items-start justify-between">
      <MonoLabel>{label}</MonoLabel>
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-accent/10", color === "text-accent" ? "bg-accent/10" : "bg-muted/50")}>
        <Icon size={15} className={color} />
      </span>
    </div>
    <p className={cn("mt-3 text-3xl font-semibold tabular-nums", color)}>
      {typeof value === "number" ? value : value}
      {typeof value === "number" && unit}
    </p>
    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
  </Panel>
);

// ─── Detail Row ───────────────────────────────────────────────────────────────

const AuditRow = ({ record }: { record: AuditRecord }) => {
  const [expanded, setExpanded] = useState(false);
  const m = record.evaluation_matrix;

  return (
    <>
      <tr
        className="border-b border-border/60 text-sm transition-colors duration-200 hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-4 py-3">
          <div className="max-w-[260px] truncate font-medium text-foreground" title={record.query}>
            {record.query || "—"}
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
            {new Date(record.created_at).toLocaleString()}
          </div>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
              m.faithfulness !== undefined && m.faithfulness >= 85
                ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                : m.faithfulness !== undefined && m.faithfulness >= 65
                  ? "text-amber-400 border-amber-500/20 bg-amber-500/10"
                  : "text-red-400 border-red-500/20 bg-red-500/10",
            )}
          >
            {m.faithfulness !== undefined ? `${m.faithfulness}%` : "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn("font-mono text-xs tabular-nums", scoreColor(m.context_precision))}>
            {m.context_precision !== undefined ? `${m.context_precision}%` : "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn("font-mono text-xs tabular-nums", scoreColor(m.answer_relevance))}>
            {m.answer_relevance !== undefined ? `${m.answer_relevance}%` : "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
              riskBadge(m.hallucination_risk),
            )}
          >
            {riskIcon(m.hallucination_risk)}
            {m.hallucination_risk ?? "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn("font-mono text-xs font-bold tabular-nums", scoreColor(m.composite_confidence ?? record.confidence_score))}>
            {m.composite_confidence ?? record.confidence_score ?? "—"}
            {(m.composite_confidence ?? record.confidence_score) !== undefined && "%"}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-muted-foreground">{record.sources_count}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            aria-label={expanded ? "Collapse" : "Expand"}
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p); }}
          >
            <Eye size={11} />
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/40 bg-muted/20">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Answer preview */}
              <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                <MonoLabel className="text-[9px]">AI Answer</MonoLabel>
                <p className="mt-2 max-h-32 overflow-y-auto text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
                  {record.answer || "—"}
                </p>
              </div>

              {/* Score breakdown */}
              <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
                <MonoLabel className="text-[9px]">Evaluation Breakdown</MonoLabel>
                <ScoreBar value={m.faithfulness} label="Faithfulness" />
                <ScoreBar value={m.context_precision} label="Context Precision" />
                <ScoreBar value={m.answer_relevance} label="Answer Relevance" />
                {m.consensus_alignment !== undefined && (
                  <ScoreBar value={m.consensus_alignment} label="Consensus Alignment" />
                )}
                <div className="flex items-center gap-2 pt-1">
                  <MonoLabel className="text-[9px]">Hallucination Risk:</MonoLabel>
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider", riskBadge(m.hallucination_risk))}>
                    {riskIcon(m.hallucination_risk)}
                    {m.hallucination_risk ?? "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function EvaluationsPage() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getAuditTrail();
      setRecords(data.records ?? []);
      setSummary(data.summary ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered =
    filter === "all"
      ? records
      : records.filter((r) => r.evaluation_matrix?.hallucination_risk === filter);

  const exportJSON = () => {
    setExporting(true);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            export_timestamp: new Date().toISOString(),
            system: "TrustRAG Multi-Agent Consensus Framework",
            summary,
            records: filtered,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustrag-audit-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const exportCSV = () => {
    setExporting(true);
    const headers = [
      "ID",
      "Query",
      "Faithfulness(%)",
      "Context Precision(%)",
      "Answer Relevance(%)",
      "Hallucination Risk",
      "Composite Confidence(%)",
      "Sources Count",
      "Consensus Status",
      "Timestamp",
    ];
    const rows = filtered.map((r) =>
      [
        r.id,
        `"${(r.query || "").replace(/"/g, '""')}"`,
        r.evaluation_matrix?.faithfulness ?? "",
        r.evaluation_matrix?.context_precision ?? "",
        r.evaluation_matrix?.answer_relevance ?? "",
        r.evaluation_matrix?.hallucination_risk ?? "",
        r.evaluation_matrix?.composite_confidence ?? r.confidence_score ?? "",
        r.sources_count,
        r.consensus_status,
        new Date(r.created_at).toISOString(),
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustrag-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Enterprise Compliance"
        title="Evaluations & Audit Trail"
        description="Real-time RAG evaluation matrix for every AI query — Faithfulness, Context Precision, Answer Relevance, Hallucination Risk, and Composite Confidence derived from multi-agent consensus deliberation."
        action={
          <div className="flex items-center gap-2">
            <button
              id="refresh-audit-btn"
              onClick={() => void fetchData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              id="export-csv-btn"
              onClick={exportCSV}
              disabled={exporting || records.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <Download size={13} />
              CSV
            </button>
            <button
              id="export-json-btn"
              onClick={exportJSON}
              disabled={exporting || records.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              <Download size={13} />
              Export JSON
            </button>
          </div>
        }
      />

      {/* Summary Metric Cards */}
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          label="Total Audited"
          value={summary?.total_evaluations ?? 0}
          unit=""
          color="text-accent"
          description="Total AI responses evaluated with full RAG matrix"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Avg Faithfulness"
          value={summary?.avg_faithfulness ?? 0}
          color="text-emerald-400"
          description="Average grounding rate — answers derived from retrieved context"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Relevance"
          value={summary?.avg_answer_relevance ?? 0}
          color="text-blue-400"
          description="Average semantic match between query and generated answer"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Hallucination-Free"
          value={summary?.hallucination_free_rate ?? 0}
          color="text-violet-400"
          description="Percentage of responses with low hallucination risk score"
        />
      </div>

      {/* Precision Summary */}
      {summary && (
        <Panel className="animate-rise mt-4 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <MonoLabel>Context Precision Score</MonoLabel>
              <p className="mt-1 text-xs text-muted-foreground">
                Average similarity of retrieved chunks to each query
              </p>
            </div>
            <div className="flex items-center gap-3 sm:shrink-0">
              <div className="h-2 w-48 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-1000"
                  style={{ width: `${summary.avg_context_precision}%` }}
                />
              </div>
              <span className="font-mono text-sm font-bold text-foreground tabular-nums">
                {summary.avg_context_precision}%
              </span>
            </div>
          </div>
        </Panel>
      )}

      {/* Filters */}
      <div className="mt-4 flex items-center gap-2">
        <Filter size={13} className="text-muted-foreground" />
        <MonoLabel className="mr-2 text-[9px]">Filter by risk:</MonoLabel>
        {(["all", "low", "medium", "high"] as const).map((f) => (
          <button
            key={f}
            id={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors",
              filter === f
                ? f === "all"
                  ? "border-accent bg-accent/15 text-accent"
                  : f === "low"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : f === "medium"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-border bg-secondary/30 text-muted-foreground hover:border-border/80 hover:bg-secondary",
            )}
          >
            {f === "all" ? "All" : `${f} risk`}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Error State */}
      {error && (
        <Panel className="mt-4 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Failed to load audit trail</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
            </div>
            <button
              onClick={() => void fetchData()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw size={11} />
              Retry
            </button>
          </div>
        </Panel>
      )}

      {/* Loading */}
      {loading && !error && (
        <Panel className="mt-4 animate-pulse p-10 text-center">
          <Activity size={24} className="mx-auto text-accent animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Loading evaluation records…</p>
        </Panel>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <Panel className="mt-4 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/40">
            <ClipboardList size={22} className="text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">No evaluation records yet</p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
            Upload documents and send AI chat queries — each response will generate a full RAG evaluation matrix that appears here.
          </p>
        </Panel>
      )}

      {/* Audit Table */}
      {!loading && !error && filtered.length > 0 && (
        <Panel className="animate-rise mt-4 overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-0">
            <MonoLabel>Evaluation Records</MonoLabel>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-y border-border text-muted-foreground">
                  {[
                    "Query",
                    "Faithfulness",
                    "Ctx Precision",
                    "Relevance",
                    "Halluc. Risk",
                    "Confidence",
                    "Sources",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-mono text-[9px] font-normal uppercase tracking-[0.12em]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <AuditRow key={record.id} record={record} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
