import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AGENT_STEPS, ANSWER, CHUNKS } from "@/lib/trustrag-data";
import { Meter, MonoLabel, PageHeader, Panel, ScorePill } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/chat")({
  head: () => ({
    meta: [
      { title: "AI Chat — TrustRAG Console" },
      {
        name: "description",
        content: "Ask questions about your documents and watch the multi-agent pipeline retrieve, verify and score every answer.",
      },
      { property: "og:title", content: "TrustRAG AI Chat" },
      { property: "og:description", content: "Answers with evidence, trust, confidence and consensus." },
    ],
  }),
  component: ChatPage,
});

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

function Timeline({ active }: { active: number }) {
  return (
    <ol className="relative ml-1 space-y-3 border-l border-border pl-5">
      {AGENT_STEPS.map((s, i) => {
        const done = i < active;
        const running = i === active;
        return (
          <li key={s.key} className="relative">
            <span
              className={`absolute -left-[26px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors duration-500 ${
                done
                  ? "border-emerald-400/50 bg-emerald-400"
                  : running
                    ? "border-accent bg-accent/40"
                    : "border-border bg-background"
              }`}
            />
            <div
              className={`transition-opacity duration-500 ${done || running ? "opacity-100" : "opacity-40"}`}
            >
              <div className="flex items-center gap-2 text-sm">
                {s.label}
                {running && <Loader2 size={12} className="animate-spin text-accent" />}
              </div>
              {(done || running) && (
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ChatPage() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("What does the Phase III trial say about relapse reduction?");
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [runId, setRunId] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent pipeline animation
  useEffect(() => {
    setStep(0);
    setTyped("");
    setVote(null);
    const t = setInterval(() => {
      setStep((s) => {
        if (s >= AGENT_STEPS.length) {
          clearInterval(t);
          return s;
        }
        return s + 1;
      });
    }, 520);
    return () => clearInterval(t);
  }, [runId]);

  // Streaming answer
  useEffect(() => {
    if (step < AGENT_STEPS.length) return;
    let i = 0;
    const t = setInterval(() => {
      i += 3;
      setTyped(ANSWER.slice(0, i));
      if (i >= ANSWER.length) clearInterval(t);
    }, 12);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [typed, step]);

  const streaming = step >= AGENT_STEPS.length && typed.length < ANSWER.length;

  return (
    <>
      <PageHeader
        eyebrow="Multi-agent RAG"
        title="Ask. Then check the working."
        description="Every answer arrives with its retrieval trail, verified claims and the agents' agreement level."
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* Conversation */}
        <div className="flex min-h-[70vh] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm border border-border bg-white/10 px-4 py-3 text-sm">
                {asked}
              </div>
            </div>

            <Panel className="animate-rise p-5">
              <MonoLabel>Execution timeline</MonoLabel>
              <div className="mt-4">
                <Timeline active={step} />
              </div>
            </Panel>

            {step >= AGENT_STEPS.length && (
              <Panel className="animate-rise p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-accent" />
                  <MonoLabel>Generated answer</MonoLabel>
                </div>

                <div className="mt-4">
                  <Markdown text={typed} />
                  {streaming && (
                    <span className="animate-caret ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-accent" />
                  )}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <ScorePill label="Confidence" value={92} tone="good" />
                  <ScorePill label="Trust score" value={88} tone="good" />
                  <ScorePill label="Consensus" value={76} tone="warn" />
                </div>

                <div className="mt-5">
                  <MonoLabel>Supporting sources</MonoLabel>
                  <ul className="mt-3 space-y-2">
                    {CHUNKS.slice(0, 3).map((c, i) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-xs"
                      >
                        <span className="font-mono text-[10px] text-accent">[{i + 1}]</span>
                        <span className="min-w-0 flex-1 truncate">{c.doc}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                          p.{c.page} · {c.similarity.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5">
                  <MonoLabel>Agent decisions</MonoLabel>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {AGENT_STEPS.slice(1, 6).map((s) => (
                      <li key={s.key} className="flex gap-2">
                        <ChevronRight size={12} className="mt-0.5 shrink-0 text-accent" />
                        <span>
                          <span className="text-foreground">{s.label}:</span> {s.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(ANSWER);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors duration-300 hover:bg-white/10"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => setRunId((r) => r + 1)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors duration-300 hover:bg-white/10"
                  >
                    <RefreshCw size={13} /> Regenerate
                  </button>
                  <button
                    onClick={() => setVote("up")}
                    className={`rounded-full border border-border p-2 transition-colors duration-300 hover:bg-white/10 ${vote === "up" ? "text-emerald-300" : ""}`}
                    aria-label="Helpful"
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    onClick={() => setVote("down")}
                    className={`rounded-full border border-border p-2 transition-colors duration-300 hover:bg-white/10 ${vote === "down" ? "text-destructive" : ""}`}
                    aria-label="Not helpful"
                  >
                    <ThumbsDown size={13} />
                  </button>
                </div>
              </Panel>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!question.trim()) return;
              setAsked(question.trim());
              setQuestion("");
              setRunId((r) => r + 1);
            }}
            className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card/60 p-2 backdrop-blur-md"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about uploaded documents..."
              className="h-10 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85"
            >
              <Send size={14} /> Ask
            </button>
          </form>
        </div>

        {/* Evidence panel */}
        <Panel className="animate-rise h-fit p-5 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <MonoLabel>Evidence panel</MonoLabel>
            <span className="text-xs text-muted-foreground">{CHUNKS.length} chunks</span>
          </div>

          <div className="mt-4 space-y-3">
            {CHUNKS.map((c, i) => {
              const [before, after] = c.text.split(c.highlight);
              const tone =
                c.trust === "high"
                  ? "text-emerald-300"
                  : c.trust === "medium"
                    ? "text-amber-300"
                    : "text-muted-foreground";
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border p-3 transition-colors duration-300 hover:bg-white/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      Rank {i + 1} · p.{c.page}
                    </span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${tone}`}>
                      {c.trust} trust
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-xs font-medium">{c.doc}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {before}
                    <mark className="rounded bg-accent/20 px-0.5 text-foreground">{c.highlight}</mark>
                    {after}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Meter value={c.similarity * 100} />
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {c.similarity.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}