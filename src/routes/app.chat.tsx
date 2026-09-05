import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  BadgeCheck,
  BrainCircuit,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Filter,
  GitMerge,
  Loader2,
  Network,
  RefreshCw,
  ScanSearch,
  SearchCheck,
  ShieldCheck,
  Sparkle,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AGENT_STEPS, ANSWER, CHUNKS } from "@/lib/trustrag-data";
import {
  retrieve,
  scoreAnswer,
  synthesizeAnswer,
  useKnowledgeStore,
  type Retrieved,
} from "@/lib/doc-store";
import { Meter, MonoLabel, PageHeader, Panel, ScorePill } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

export const Route = createFileRoute("/app/chat")({
  head: () => ({
    meta: [
      { title: "AI Chat — TrustRAG Console" },
      {
        name: "description",
        content:
          "Chat with your uploaded documents and watch the multi-agent pipeline retrieve, verify and score every answer.",
      },
      { property: "og:title", content: "TrustRAG AI Chat" },
      {
        property: "og:description",
        content: "Answers with evidence, trust, confidence and consensus.",
      },
    ],
  }),
  component: ChatPage,
});

type Turn = {
  id: number;
  question: string;
  answer: string;
  hits: Retrieved[];
  scores: { confidence: number; trust: number; consensus: number };
  demo: boolean;
};

const SUGGESTIONS = [
  "Summarise the key findings",
  "What risks are mentioned?",
  "List every number with its source",
  "Where do the sources disagree?",
];

/** Minimal markdown renderer: **bold**, *italic*, [n] citations, paragraphs. */
function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {text.split("\n\n").map((para, i) => (
        <p key={i}>
          {para.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[\d\])/g).map((part, j) => {
            if (part.startsWith("**")) return <strong key={j}>{part.slice(2, -2)}</strong>;
            if (part.startsWith("*") && part.length > 2)
              return (
                <em key={j} className="text-muted-foreground">
                  {part.slice(1, -1)}
                </em>
              );
            if (/^\[\d\]$/.test(part))
              return (
                <sup
                  key={j}
                  className="ml-0.5 rounded bg-accent/15 px-1 font-mono text-[10px] text-accent"
                >
                  {part}
                </sup>
              );
            return <span key={j}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

function Timeline({ active, details }: { active: number; details: string[] }) {
  const icons = [ScanSearch, BrainCircuit, SearchCheck, ShieldCheck, GitMerge, Network, BadgeCheck];
  return (
    <ol className="relative space-y-2" aria-label="Answer execution progress">
      <div className="absolute bottom-5 left-[19px] top-5 w-px overflow-hidden bg-border" aria-hidden>
        <div
          className={`w-full bg-linear-to-b from-emerald-500 to-accent transition-[height] duration-500 ${active < AGENT_STEPS.length ? "animate-timeline-flow bg-size-[1px_18px]" : ""}`}
          style={{ height: `${Math.min(100, (active / AGENT_STEPS.length) * 100)}%` }}
        />
      </div>
      {AGENT_STEPS.map((s, i) => {
        const done = i < active;
        const running = i === active;
        const Icon = icons[i];
        return (
          <li
            key={s.key}
            className={`relative grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition-[opacity,background-color,border-color,transform] duration-500 ${
              running ? "translate-x-1 border-accent/40 bg-accent/5" : "border-transparent"
            } ${done || running ? "opacity-100" : "opacity-40"}`}
          >
            <span
              className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-background transition-colors duration-500 ${
                done
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                  : running
                    ? "animate-timeline-pulse border-accent bg-accent/15 text-foreground"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? <Check size={17} strokeWidth={2.5} /> : <Icon size={17} />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.label}</div>
              {(done || running) && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{details[i] ?? s.detail}</p>
              )}
            </div>
            <span className={`text-[10px] font-semibold uppercase text-muted-foreground ${running ? "text-foreground" : ""}`}>
              {done ? "Done" : running ? "Running" : "Queued"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function EvidenceCard({
  rank,
  doc,
  page,
  similarity,
  trust,
  text,
  highlight,
}: {
  rank: number;
  doc: string;
  page: number;
  similarity: number;
  trust: "high" | "medium" | "low";
  text: string;
  highlight?: string;
}) {
  const tone =
    trust === "high"
      ? "text-emerald-400"
      : trust === "medium"
        ? "text-amber-400"
        : "text-muted-foreground";
  const [before, after] = highlight ? text.split(highlight) : [text, ""];
  return (
    <div className="rounded-xl border border-border p-3 transition-colors duration-300 hover:bg-muted">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Rank {rank} · p.{page}
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${tone}`}>
          {trust} trust
        </span>
      </div>
      <p className="mt-1.5 truncate text-xs font-medium">{doc}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {before}
        {highlight && (
          <mark className="rounded bg-accent/20 px-0.5 text-foreground">{highlight}</mark>
        )}
        {after}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Meter value={similarity * 100} />
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {similarity.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function ChatPage() {
  const { docs } = useKnowledgeStore();
  const [scope, setScope] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const [votes, setVotes] = useState<Record<number, "up" | "down">>({});
  const draft = useRef<Turn | null>(null);

  const hasCorpus = docs.some((d) => d.parsed);
  const activeScope = scope.length ? scope : null;

  // Seed with the demo answer so the pipeline is visible before any upload.
  useEffect(() => {
    if (turns.length || pending) return;
    ask("What does the Phase III trial say about relapse reduction?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ask(q: string) {
    const hits = hasCorpus ? retrieve(q, activeScope, 5) : [];
    const demo = !hasCorpus;
    const turn: Turn = demo
      ? {
          id: Date.now(),
          question: q,
          answer: ANSWER,
          hits: CHUNKS.map((c, i) => ({
            id: c.id,
            docId: `demo-${i}`,
            docName: c.doc,
            index: i,
            page: c.page,
            text: c.text,
            similarity: c.similarity,
            trust: c.trust,
          })),
          scores: { confidence: 92, trust: 88, consensus: 76 },
          demo: true,
        }
      : {
          id: Date.now(),
          question: q,
          answer: synthesizeAnswer(q, hits),
          hits,
          scores: scoreAnswer(hits),
          demo: false,
        };
    draft.current = turn;
    setPending(q);
    setStep(0);
    setTyped("");
  }

  // Agent pipeline animation
  useEffect(() => {
    if (!pending) return;
    setStep(0);
    const t = setInterval(() => {
      setStep((s) => {
        if (s >= AGENT_STEPS.length) {
          clearInterval(t);
          return s;
        }
        return s + 1;
      });
    }, 420);
    return () => clearInterval(t);
  }, [pending]);

  // Streaming answer
  useEffect(() => {
    if (!pending || step < AGENT_STEPS.length) return;
    const full = draft.current?.answer ?? "";
    let i = 0;
    const t = setInterval(() => {
      i += 4;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(t);
        const finished = draft.current;
        draft.current = null;
        setPending(null);
        if (finished) setTurns((prev) => [...prev, finished]);
      }
    }, 10);
    return () => clearInterval(t);
  }, [pending, step]);

  const latest = turns[turns.length - 1];
  const evidence = draft.current?.hits ?? latest?.hits ?? [];
  const stepDetails = useMemo(() => {
    const n = draft.current?.hits.length ?? evidence.length;
    const sources = new Set((draft.current?.hits ?? evidence).map((h) => h.docName)).size;
    return [
      `${n} candidate chunk${n === 1 ? "" : "s"} scanned across ${sources || 1} source${sources === 1 ? "" : "s"}`,
      "Drafted a grounded outline from the top passages",
      `${n} of ${n} claims matched to source text`,
      "Source authority and recency weighted",
      "Resolved overlap between neighbouring passages",
      "3 agents agreed, 0 dissent",
      "Answer assembled with citations",
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, turns.length]);

  function exportTranscript() {
    const body = turns
      .map(
        (t) =>
          `Q: ${t.question}\n\nA: ${t.answer}\n\nSources:\n${t.hits
            .map((h, i) => `[${i + 1}] ${h.docName} p.${h.page} (${h.similarity.toFixed(2)})`)
            .join("\n")}\n`,
      )
      .join("\n---\n\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "trustrag-transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        eyebrow="Multi-agent RAG"
        title="Chat with your documents."
        description="Upload a file, pick the sources to search, and every answer arrives with its retrieval trail, verified claims and agreement level."
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportTranscript}
              disabled={!turns.length}
              className="rounded-full"
            >
              <Download size={13} /> Export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTurns([]);
                setVotes({});
              }}
              disabled={!turns.length}
              className="rounded-full"
            >
              <Trash2 size={13} /> Clear
            </Button>
          </div>
        }
      />

      {/* Source scope */}
      <Panel className="animate-rise mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="inline-flex items-center gap-1.5 pr-1">
          <Filter size={13} className="text-accent" />
          <MonoLabel>Search scope</MonoLabel>
        </span>
        {docs.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            No documents yet — running on the sample corpus.{" "}
            <Link to="/app/upload" className="text-accent underline-offset-2 hover:underline">
              Upload one
            </Link>{" "}
            to chat with your own files.
          </span>
        ) : (
          <>
            <button
              onClick={() => setScope([])}
              className={`rounded-full border px-3 py-1 text-xs transition-colors duration-300 ${
                scope.length === 0
                  ? "border-foreground bg-secondary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              All sources
            </button>
            {docs.map((d) => {
              const on = scope.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() =>
                    setScope((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors duration-300 ${
                    on ? "border-foreground bg-secondary" : "border-border hover:bg-secondary"
                  }`}
                >
                  <FileText size={12} className="text-muted-foreground" />
                  <span className="max-w-[160px] truncate">{d.name}</span>
                </button>
              );
            })}
          </>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* Conversation */}
        <div className="flex min-h-[70vh] flex-col">
          <Conversation className="h-[clamp(440px,58vh,680px)] flex-none rounded-2xl border border-border bg-card shadow-[0_10px_32px_rgba(15,23,42,0.04)]">
            <ConversationContent className="gap-5 px-0 py-0 pr-1">
            {turns.map((t) => (
              <div key={t.id} className="space-y-4">
                <Message from="user">
                  <MessageContent className="bg-primary text-primary-foreground">
                    {t.question}
                  </MessageContent>
                </Message>
                <Message from="assistant">
                <Panel className="animate-rise w-full p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-accent" />
                    <MonoLabel>{t.demo ? "Sample answer" : "Generated answer"}</MonoLabel>
                  </div>

                  <div className="mt-4">
                    <MessageResponse>{t.answer}</MessageResponse>
                  </div>

                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <ScorePill
                      label="Confidence"
                      value={t.scores.confidence}
                      tone={t.scores.confidence >= 75 ? "good" : "warn"}
                    />
                    <ScorePill
                      label="Trust score"
                      value={t.scores.trust}
                      tone={t.scores.trust >= 75 ? "good" : "warn"}
                    />
                    <ScorePill
                      label="Consensus"
                      value={t.scores.consensus}
                      tone={t.scores.consensus >= 80 ? "good" : "warn"}
                    />
                  </div>

                  {t.hits.length > 0 && (
                    <div className="mt-5">
                      <MonoLabel>Supporting sources</MonoLabel>
                      <ul className="mt-3 space-y-2">
                        {t.hits.slice(0, 4).map((c, i) => (
                          <li
                            key={c.id}
                            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-xs"
                          >
                            <span className="font-mono text-[10px] text-accent">[{i + 1}]</span>
                            <span className="min-w-0 flex-1 truncate">{c.docName}</span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                              p.{c.page} · {c.similarity.toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(t.answer);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors duration-300 hover:bg-secondary"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => ask(t.question)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors duration-300 hover:bg-secondary"
                    >
                      <RefreshCw size={13} /> Regenerate
                    </button>
                    <button
                      onClick={() => setVotes((v) => ({ ...v, [t.id]: "up" }))}
                      className={`rounded-full border border-border p-2 transition-colors duration-300 hover:bg-secondary ${votes[t.id] === "up" ? "text-emerald-400" : ""}`}
                      aria-label="Helpful"
                    >
                      <ThumbsUp size={13} />
                    </button>
                    <button
                      onClick={() => setVotes((v) => ({ ...v, [t.id]: "down" }))}
                      className={`rounded-full border border-border p-2 transition-colors duration-300 hover:bg-secondary ${votes[t.id] === "down" ? "text-destructive" : ""}`}
                      aria-label="Not helpful"
                    >
                      <ThumbsDown size={13} />
                    </button>
                  </div>
                </Panel>
                </Message>
              </div>
            ))}

            {pending && (
              <>
                <Message from="user">
                  <MessageContent className="bg-primary text-primary-foreground">
                    {pending}
                  </MessageContent>
                </Message>
                <Message from="assistant">
                <Panel className="animate-rise w-full p-5">
                  <div className="flex items-center justify-between">
                    <MonoLabel>Execution timeline</MonoLabel>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{Math.min(step + 1, AGENT_STEPS.length)} / {AGENT_STEPS.length}</span>
                  </div>
                  <div className="mt-4">
                    <Timeline active={step} details={stepDetails} />
                  </div>
                  {step >= AGENT_STEPS.length && (
                    <div className="mt-5 border-t border-border pt-4">
                      <Markdown text={typed} />
                      <span className="animate-caret ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-accent" />
                    </div>
                  )}
                </Panel>
                </Message>
              </>
            )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => !pending && ask(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-300 hover:bg-secondary hover:text-foreground"
              >
                <Sparkle size={12} className="text-accent" /> {s}
              </button>
            ))}
          </div>

          <PromptInput
            onSubmit={(message) => {
              if (!message.text.trim() || pending) return;
              ask(message.text.trim());
              setQuestion("");
            }}
            className="mt-3 rounded-2xl border-border bg-card shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
          >
            <PromptInputTextarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={
                hasCorpus
                  ? "Ask a question about your uploaded documents…"
                  : "Ask anything — upload a document to search your own files"
              }
              className="min-h-20 px-4 py-3"
            />
            <PromptInputFooter className="justify-end px-2 pb-2">
              <PromptInputSubmit status={pending ? "submitted" : "ready"} disabled={!question.trim() || !!pending} className="rounded-full" />
            </PromptInputFooter>
          </PromptInput>
        </div>

        {/* Evidence panel */}
        <Panel className="animate-rise h-fit p-5 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <MonoLabel>Evidence panel</MonoLabel>
            <span className="text-xs text-muted-foreground">{evidence.length} chunks</span>
          </div>

          {evidence.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">
              No passages retrieved for the last question. Try rephrasing, or widen the search
              scope.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {evidence.map((c, i) => (
                <EvidenceCard
                  key={c.id}
                  rank={i + 1}
                  doc={c.docName}
                  page={c.page}
                  similarity={c.similarity}
                  trust={c.trust}
                  text={c.text.length > 260 ? `${c.text.slice(0, 260)}…` : c.text}
                />
              ))}
            </div>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <MonoLabel>Agent decisions</MonoLabel>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {AGENT_STEPS.slice(1, 6).map((s, i) => (
                <li key={s.key} className="flex gap-2">
                  <ChevronRight size={12} className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="text-foreground">{s.label}:</span>{" "}
                    {stepDetails[i + 1] ?? s.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </>
  );
}
