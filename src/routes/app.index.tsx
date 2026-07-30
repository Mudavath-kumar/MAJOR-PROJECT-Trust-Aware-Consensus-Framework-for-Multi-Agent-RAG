import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  FileText,
  Gauge,
  MessageSquare,
  ShieldCheck,
  Upload,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ACTIVITY, DOCUMENTS } from "@/lib/trustrag-data";
import { Meter, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TrustRAG Console" },
      {
        name: "description",
        content: "Documents indexed, queries answered, confidence and trust averages at a glance.",
      },
      { property: "og:title", content: "TrustRAG Dashboard" },
      { property: "og:description", content: "Live view of your evidence-backed AI workspace." },
    ],
  }),
  component: Dashboard,
});

function useCounter(target: number, decimals = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v.toFixed(decimals);
}

function Stat({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  decimals = 0,
  meter,
  delay,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint: string;
  icon: typeof FileText;
  decimals?: number;
  meter?: number;
  delay: number;
}) {
  const shown = useCounter(value, decimals);
  return (
    <Panel
      className="animate-rise p-5 transition-colors duration-300 hover:border-white/25"
      // stagger
    >
      <div style={{ animationDelay: `${delay}ms` }}>
        <div className="flex items-start justify-between">
          <MonoLabel>{label}</MonoLabel>
          <Icon size={16} className="text-accent" />
        </div>
        <div className="mt-3 text-3xl font-medium tabular-nums">
          {shown}
          {suffix}
        </div>
        {meter !== undefined && <Meter value={meter} className="mt-3" />}
        <p className="mt-3 text-xs text-muted-foreground">{hint}</p>
      </div>
    </Panel>
  );
}

function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Everything, with its evidence."
        description="A live read on your corpus, the questions asked of it, and how much the agents trust their own answers."
        action={
          <Link
            to="/app/chat"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85"
          >
            <MessageSquare size={15} /> Ask a question
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total documents" value={128} hint="6 added this week" icon={FileText} delay={0} />
        <Stat label="Total queries" value={1394} hint="+18% vs last week" icon={MessageSquare} delay={60} />
        <Stat label="Avg confidence" value={87.4} suffix="%" decimals={1} meter={87.4} hint="Across the last 200 answers" icon={Gauge} delay={120} />
        <Stat label="Avg trust score" value={91.2} suffix="%" decimals={1} meter={91.2} hint="Weighted by source authority" icon={ShieldCheck} delay={180} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel className="animate-rise p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <MonoLabel>Recent activity</MonoLabel>
            <Activity size={16} className="text-muted-foreground" />
          </div>
          <ul className="mt-4 divide-y divide-border">
            {ACTIVITY.map((a) => (
              <li key={a.what} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-medium">{a.who}</span>{" "}
                    <span className="text-muted-foreground">{a.what}</span>
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {a.when}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="animate-rise p-5">
            <MonoLabel>Quick actions</MonoLabel>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                to="/app/upload"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors duration-300 hover:bg-white/5"
              >
                <Upload size={16} className="text-accent" /> Upload documents
              </Link>
              <Link
                to="/app/knowledge"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors duration-300 hover:bg-white/5"
              >
                <FileText size={16} className="text-accent" /> Browse knowledge base
              </Link>
              <Link
                to="/app/analytics"
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors duration-300 hover:bg-white/5"
              >
                <Zap size={16} className="text-accent" /> Review hallucination rate
              </Link>
            </div>
          </Panel>

          <Panel className="animate-rise p-5">
            <MonoLabel>System status</MonoLabel>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["Retrieval index", "Operational"],
                ["Embedding worker", "Operational"],
                ["Consensus engine", "Degraded"],
                ["LLM gateway", "Operational"],
              ].map(([name, state]) => (
                <li key={name} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${state === "Operational" ? "bg-emerald-400" : "bg-amber-400"}`}
                    />
                    <span className="text-xs">{state}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel className="animate-rise mt-6 p-5">
        <MonoLabel>Recently uploaded</MonoLabel>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DOCUMENTS.slice(0, 6).map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-border p-4 transition-colors duration-300 hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {d.type} · {d.size}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.15em] ${d.status === "ready" ? "text-emerald-300" : "text-amber-300"}`}
                >
                  {d.status}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium">{d.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {d.chunks} chunks · {d.uploaded}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}