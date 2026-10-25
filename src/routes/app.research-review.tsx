import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  RotateCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";
import {
  ApiClient,
  type ResearchAnswerType,
  type ResearchBenchmarkDetail,
  type ResearchBenchmarkList,
  type ResearchReviewDecision,
  type ResearchReviewStatus,
} from "@/lib/api-client";

export const Route = createFileRoute("/app/research-review")({
  head: () => ({
    meta: [
      { title: "Research Review — TrustRAG Console" },
      {
        name: "description",
        content: "Review source-linked benchmark cases before paper evaluation.",
      },
    ],
  }),
  component: ResearchReview,
});

const ANSWER_TYPES: Array<ResearchAnswerType | "all"> = [
  "all",
  "answerable",
  "unanswerable",
  "conflicting",
  "prompt_injection",
];
const REVIEW_STATES: Array<ResearchReviewStatus | "all"> = [
  "all",
  "unreviewed",
  "approved",
  "needs_correction",
];
const label = (value: string) => value.replaceAll("_", " ");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, facts }: { text: string; facts: string[] }) {
  const spans = useMemo(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    for (const fact of facts.filter(Boolean).sort((a, b) => b.length - a.length)) {
      const match = new RegExp(escapeRegExp(fact), "ig").exec(text);
      if (
        match &&
        !ranges.some(
          (range) => match.index < range.end && match.index + match[0].length > range.start,
        )
      ) {
        ranges.push({ start: match.index, end: match.index + match[0].length });
      }
    }
    return ranges.sort((a, b) => a.start - b.start);
  }, [facts, text]);
  if (!spans.length) return <>{text}</>;
  const pieces = [];
  let start = 0;
  for (const range of spans) {
    if (range.start > start)
      pieces.push(<span key={`text-${start}`}>{text.slice(start, range.start)}</span>);
    pieces.push(
      <mark
        key={`fact-${range.start}`}
        className="rounded bg-amber-300/25 px-0.5 text-foreground ring-1 ring-amber-400/30"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    start = range.end;
  }
  if (start < text.length) pieces.push(<span key={`text-${start}`}>{text.slice(start)}</span>);
  return <>{pieces}</>;
}

function ResearchReview() {
  const [data, setData] = useState<ResearchBenchmarkList | null>(null);
  const [detail, setDetail] = useState<ResearchBenchmarkDetail | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResearchAnswerType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ResearchReviewStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSettledSearch(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void ApiClient.getResearchBenchmark({
      page,
      type: typeFilter,
      status: statusFilter,
      search: settledSearch,
    })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setSelectedId((current) =>
          result.records.some((record) => record.id === current)
            ? current
            : (result.records[0]?.id ?? ""),
        );
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "Unable to load research review records.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, typeFilter, statusFilter, settledSearch, reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    setSaveError(null);
    void ApiClient.getResearchBenchmarkRecord(selectedId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setNotes(result.review?.notes ?? "");
      })
      .catch((reason) => {
        if (!cancelled)
          setSaveError(reason instanceof Error ? reason.message : "Unable to load this record.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, reloadKey]);

  const currentIndex = data?.records.findIndex((record) => record.id === selectedId) ?? -1;
  const selectedSummary = currentIndex >= 0 ? data?.records[currentIndex] : undefined;
  const progress = data?.progress;
  const exportReady = Boolean(
    data?.audit.status === "passed" &&
    progress?.approved === 200 &&
    progress.unreviewed === 0 &&
    progress.needs_correction === 0,
  );

  async function saveReview(decision: ResearchReviewDecision) {
    if (!detail) return;
    if (decision === "needs_correction" && !notes.trim()) {
      setSaveError("Add a note describing the correction needed before saving this decision.");
      return;
    }
    if (
      detail.review &&
      detail.review.decision !== decision &&
      !window.confirm(
        `Change ${detail.record.id} from “${label(detail.review.decision)}” to “${label(decision)}”?`,
      )
    )
      return;
    setSaving(true);
    setSaveError(null);
    try {
      await ApiClient.saveResearchBenchmarkReview(detail.record.id, {
        decision,
        notes: notes.trim(),
        expectedUpdatedAt: detail.review?.updatedAt ?? null,
      });
      setReloadKey((value) => value + 1);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Unable to save this review.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadExport() {
    setExporting(true);
    setSaveError(null);
    try {
      const blob = await ApiClient.downloadResearchBenchmarkExport();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${data?.dataset.version ?? "trustrag-reviewed"}-reviewed.jsonl`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "Unable to export reviewed data.");
    } finally {
      setExporting(false);
    }
  }

  function moveRecord(direction: -1 | 1) {
    if (currentIndex < 0 || !data) return;
    const next = data.records[currentIndex + direction];
    if (next) setSelectedId(next.id);
    else if (direction > 0 && page < data.page.pages) setPage((value) => value + 1);
    else if (direction < 0 && page > 1) setPage((value) => value - 1);
  }

  return (
    <>
      <PageHeader
        eyebrow="Research benchmark"
        title="Review the evidence, record your decision."
        description="Inspect the frozen HotpotQA-derived cases and their scoped documents before using this dataset in paper runs."
        action={
          <Button
            disabled={!exportReady || exporting}
            onClick={() => void downloadExport()}
            className="gap-2 rounded-full"
          >
            <ArrowDownToLine size={15} />{" "}
            {exporting ? "Preparing export…" : "Export reviewed JSONL"}
          </Button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total records", progress?.total ?? "—"],
          ["Unreviewed", progress?.unreviewed ?? "—"],
          ["Approved", progress?.approved ?? "—"],
          ["Needs correction", progress?.needs_correction ?? "—"],
        ].map(([title, value]) => (
          <Panel key={title} className="p-4">
            <MonoLabel>{title}</MonoLabel>
            <div className="mt-2 text-2xl font-medium tabular-nums">{value}</div>
          </Panel>
        ))}
      </div>

      <Panel className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {data?.audit.status === "passed" ? (
            <ShieldCheck className="mt-0.5 text-emerald-500" size={18} />
          ) : (
            <AlertTriangle className="mt-0.5 text-amber-500" size={18} />
          )}
          <div>
            <div className="text-sm font-medium">
              Automated consistency audit: {data?.audit.status ?? "loading"}
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              The audit checks source linkage, corpus hashes and scope, supporting facts, and
              synthetic challenge structure. It does not prove semantic correctness or human
              agreement; this workflow records one human reviewer plus automated checks.
            </p>
          </div>
        </div>
        <div className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {data?.dataset.version ?? ""}
        </div>
      </Panel>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.7fr)]">
        <Panel className="min-w-0 overflow-hidden">
          <div className="space-y-3 border-b border-border p-4">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ID or question"
                aria-label="Search benchmark records"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Filter by record category"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as ResearchAnswerType | "all");
                  setPage(1);
                }}
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs capitalize"
              >
                {ANSWER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === "all" ? "All types" : label(type)}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by review status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as ResearchReviewStatus | "all");
                  setPage(1);
                }}
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs capitalize"
              >
                {REVIEW_STATES.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "All states" : label(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{data?.page.total ?? 0} matching records</span>
              <span>
                Page {data?.page.number ?? 1} / {data?.page.pages || 1}
              </span>
            </div>
          </div>
          <div className="max-h-[70vh] min-h-60 overflow-y-auto p-2">
            {loading && !data ? (
              <p className="p-4 text-sm text-muted-foreground">Loading benchmark records…</p>
            ) : data?.records.length ? (
              data.records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedId(record.id)}
                  className={`mb-1 w-full rounded-xl border p-3 text-left transition-colors ${record.id === selectedId ? "border-foreground/25 bg-secondary/80" : "border-transparent hover:border-border hover:bg-secondary/40"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{record.id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${record.status === "approved" ? "bg-emerald-500/10 text-emerald-500" : record.status === "needs_correction" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}
                    >
                      {label(record.status)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed">{record.question}</p>
                  <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {label(record.answerType)}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No matching records"
                hint="Change the search or filters to continue."
              />
            )}
          </div>
          <div className="flex justify-between border-t border-border p-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ArrowLeft size={14} className="mr-1" /> Previous page
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!data || page >= data.page.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next page <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </Panel>

        <div className="min-w-0 space-y-5">
          {!selectedId && (
            <Panel className="p-6">
              <EmptyState
                title="Choose a record to review"
                hint="The frozen benchmark stays unchanged while your decisions are saved separately."
              />
            </Panel>
          )}
          {detailLoading && (
            <Panel className="p-5 text-sm text-muted-foreground">
              Loading source labels and scoped corpus…
            </Panel>
          )}
          {detail && !detailLoading && (
            <>
              <Panel className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <MonoLabel>{detail.record.id}</MonoLabel>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                    {label(detail.record.answer_type)}
                  </span>
                  {detail.review && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize">
                      {label(detail.review.decision)}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-xl font-medium leading-snug">{detail.record.question}</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background/60 p-3">
                    <MonoLabel>Candidate target</MonoLabel>
                    <p className="mt-2 text-sm">
                      {detail.record.gold_answer ||
                        (detail.record.answer_type === "unanswerable" ||
                        detail.record.answer_type === "conflicting"
                          ? "Abstain; no candidate answer is scored as gold."
                          : "No answer label")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/60 p-3">
                    <MonoLabel>Original HotpotQA label</MonoLabel>
                    <p className="mt-2 text-sm">{detail.source?.answer || "Unavailable"}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {detail.record.source_dataset.record_id} ·{" "}
                      {detail.record.source_dataset.license}
                    </p>
                  </div>
                </div>
                {detail.source?.supportingFacts.length ? (
                  <div className="mt-4 rounded-xl border border-border p-3">
                    <MonoLabel>Source supporting facts</MonoLabel>
                    <ul className="mt-2 space-y-2">
                      {detail.source.supportingFacts.map((fact, index) => (
                        <li
                          key={`${detail.record.id}-fact-${index}`}
                          className="text-xs leading-relaxed"
                        >
                          <span className="mr-2 rounded bg-amber-300/20 px-1.5 py-0.5 text-[9px] text-amber-700 dark:text-amber-300">
                            {detail.source?.supportingFactTitles[index] ?? `Fact ${index + 1}`}
                          </span>
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    This case is designed to have no supporting evidence in its scoped corpus.
                  </p>
                )}
                {detail.record.challenge?.synthetic && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      Synthetic challenge: {label(detail.record.challenge.intervention)}. Treat this
                      document as an experimental intervention, not source evidence.
                    </span>
                  </div>
                )}
              </Panel>

              <Panel className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <MonoLabel>Scoped corpus evidence</MonoLabel>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Compare source facts with the exact documents available to retrieval.
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {detail.documents.length} docs
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {detail.documents.map((document) => (
                    <details
                      key={document.documentId}
                      open
                      className={`rounded-xl border ${document.synthetic ? "border-amber-500/25" : "border-border"}`}
                    >
                      <summary className="cursor-pointer list-none px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                          {document.synthetic ? (
                            <AlertTriangle size={14} className="text-amber-500" />
                          ) : (
                            <ShieldCheck size={14} className="text-emerald-500" />
                          )}
                          <span className="break-all">{document.path.split("/").at(-1)}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ${document.synthetic ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}
                          >
                            {document.synthetic ? "Synthetic challenge" : "Trusted source"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[9px] leading-relaxed text-muted-foreground">
                          {document.evidenceIds.map((id) => {
                            const markedGold = detail.record.gold_evidence_ids.includes(id);
                            return (
                              <span
                                key={id}
                                className={`break-all rounded px-1 py-0.5 ${markedGold && document.synthetic ? "bg-amber-500/10 text-amber-600" : markedGold ? "bg-emerald-500/10 text-emerald-600" : "bg-secondary"}`}
                              >
                                {markedGold ? (document.synthetic ? "⚠ " : "✓ ") : ""}
                                {id}
                              </span>
                            );
                          })}
                        </div>
                      </summary>
                      {document.synthetic &&
                        document.evidenceIds.some((id) =>
                          detail.record.gold_evidence_ids.includes(id),
                        ) && (
                          <p className="border-t border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                            The frozen candidate marks this synthetic passage as a gold evidence ID.
                            Check this annotation carefully; the synthetic challenge is not a
                            trusted source document.
                          </p>
                        )}
                      <div className="max-h-72 overflow-auto border-t border-border/70 bg-background/50 p-3 text-xs leading-relaxed text-muted-foreground">
                        <pre className="whitespace-pre-wrap font-sans">
                          <HighlightedText
                            text={document.text}
                            facts={document.synthetic ? [] : (detail.source?.supportingFacts ?? [])}
                          />
                        </pre>
                      </div>
                    </details>
                  ))}
                </div>
              </Panel>

              <Panel className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <MonoLabel>Your human review</MonoLabel>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Automated integrity checks do not replace this semantic decision.
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Previous record"
                      disabled={currentIndex <= 0 && page <= 1}
                      onClick={() => moveRecord(-1)}
                    >
                      <ArrowLeft size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Next record"
                      disabled={
                        currentIndex < 0 ||
                        (currentIndex >= (data?.records.length ?? 0) - 1 &&
                          page >= (data?.page.pages ?? 1))
                      }
                      onClick={() => moveRecord(1)}
                    >
                      <ArrowRight size={15} />
                    </Button>
                  </div>
                </div>
                {saveError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive"
                  >
                    {saveError}
                  </div>
                )}
                {detail.reviewBlockers.map((blocker) => (
                  <div
                    key={blocker}
                    role="alert"
                    className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300"
                  >
                    {blocker}
                  </div>
                ))}
                {detail.review?.decision === "needs_correction" && (
                  <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                    This frozen candidate record has been flagged. It cannot be approved in this
                    version; correct and publish a new candidate version, then review that version.
                  </div>
                )}
                <label className="mt-4 block text-xs font-medium" htmlFor="research-review-notes">
                  Review notes{" "}
                  <span className="font-normal text-muted-foreground">
                    (required for correction, max 2000 characters)
                  </span>
                </label>
                <textarea
                  id="research-review-notes"
                  maxLength={2000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Record a specific mismatch, missing evidence, or why this case is sound…"
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] text-muted-foreground">
                    {detail.review?.updatedAt
                      ? `Last saved ${new Date(detail.review.updatedAt).toLocaleString()}`
                      : "Not reviewed yet"}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={saving}
                      onClick={() => void saveReview("needs_correction")}
                      className="gap-2"
                    >
                      <CircleHelp size={14} /> Needs correction
                    </Button>
                    <Button
                      disabled={
                        saving ||
                        detail.review?.decision === "needs_correction" ||
                        detail.reviewBlockers.length > 0
                      }
                      onClick={() => void saveReview("approved")}
                      className="gap-2"
                    >
                      <Check size={14} /> {saving ? "Saving…" : "Approve record"}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
                  <RotateCw size={13} className="mt-0.5 shrink-0" />A changed saved decision asks
                  for confirmation. If another tab saved first, reload and review the newer decision
                  before saving again.
                </div>
              </Panel>
            </>
          )}
          {selectedSummary && detail && (
            <p className="sr-only" aria-live="polite">
              Selected {selectedSummary.id}, {label(selectedSummary.status)}
            </p>
          )}
        </div>
      </div>

      <Panel className="mt-5 flex items-start gap-2 p-4 text-xs leading-relaxed text-muted-foreground">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <p>
          {exportReady
            ? "All 200 records have an approved review and the automated source-integrity audit passed. The export records one human reviewer plus automated checks; it does not create evaluation results."
            : `JSONL export is locked until your account has approved all 200 records and the fixed automated audit passes. Current progress: ${progress?.approved ?? 0}/200 approved.`}{" "}
          Paper tables still require running the six benchmark variants on this reviewed dataset.
        </p>
      </Panel>
    </>
  );
}
