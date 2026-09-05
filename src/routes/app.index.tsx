import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, FileText, Gauge, MessageSquare, ShieldCheck, Upload } from "lucide-react";
import { ACTIVITY, DOCUMENTS } from "@/lib/trustrag-data";
import { PageHeader } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TrustRAG Console" },
      { name: "description", content: "Monitor documents, questions, confidence and trust across your TrustRAG workspace." },
      { property: "og:title", content: "TrustRAG Dashboard" },
      { property: "og:description", content: "Your evidence-backed AI workspace at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const METRICS = [
  { label: "Documents", value: "128", note: "+6 this week", icon: FileText },
  { label: "Questions", value: "1,394", note: "+18% this week", icon: MessageSquare },
  { label: "Confidence", value: "87.4%", note: "Last 200 answers", icon: Gauge },
  { label: "Trust score", value: "91.2%", note: "Source weighted", icon: ShieldCheck },
];

const PIPELINE = [
  ["Retrieval index", "Operational"],
  ["Document processor", "Operational"],
  ["Consensus engine", "Reviewing"],
  ["Evidence mapper", "Operational"],
] as const;

function Dashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title="Good morning, Mitha."
        description="Your documents are ready, the agents are online, and recent answers remain strongly grounded."
        action={<Button asChild><Link to="/app/chat"><MessageSquare /> Ask a question</Link></Button>}
      />

      <section className="border-y border-border bg-card" aria-label="Workspace metrics">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {METRICS.map(({ label, value, note, icon: Icon }, i) => (
            <div key={label} className={`p-6 ${i % 2 ? "border-l border-border" : ""} ${i > 1 ? "border-t border-border xl:border-t-0 xl:border-l" : ""}`}>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon size={17} className="text-primary" /></div>
              <div className="mt-5 font-display text-3xl font-semibold tabular-nums">{value}</div>
              <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.7fr)]">
        <section className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div><h2 className="font-display text-base font-semibold">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">The latest work across this workspace</p></div>
            <Activity size={17} className="text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {ACTIVITY.map((item, i) => (
              <div key={`${item.what}-${i}`} className="grid gap-2 px-5 py-4 sm:grid-cols-[36px_1fr_auto] sm:items-center">
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{item.who.slice(0, 1)}</span>
                <p className="text-sm"><span className="font-semibold">{item.who}</span> <span className="text-muted-foreground">{item.what}</span></p>
                <time className="text-xs text-muted-foreground">{item.when}</time>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-5 py-4"><Button asChild variant="ghost" size="sm" className="px-0 text-primary"><Link to="/app/analytics">View all activity <ArrowRight /></Link></Button></div>
        </section>

        <aside className="space-y-8">
          <section className="border border-border bg-card">
            <div className="border-b border-border px-5 py-4"><h2 className="font-display text-base font-semibold">System health</h2><p className="mt-1 text-xs text-muted-foreground">Local processing services</p></div>
            <div className="divide-y divide-border px-5">
              {PIPELINE.map(([name, state]) => (
                <div key={name} className="flex items-center justify-between py-3.5 text-sm"><span>{name}</span><span className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${state === "Operational" ? "bg-success" : "bg-warning"}`} />{state}</span></div>
              ))}
            </div>
          </section>

          <section className="border border-primary/20 bg-accent/40 p-5">
            <Upload size={19} className="text-primary" />
            <h2 className="mt-5 font-display text-lg font-semibold">Add more knowledge</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Upload documents and they become available as sources in chat.</p>
            <Button asChild variant="outline" className="mt-5 w-full bg-background"><Link to="/app/upload">Upload documents <ArrowRight /></Link></Button>
          </section>
        </aside>
      </div>

      <section className="mt-8 border border-border bg-card">
        <div className="flex items-end justify-between border-b border-border px-5 py-4">
          <div><h2 className="font-display text-base font-semibold">Recently indexed</h2><p className="mt-1 text-xs text-muted-foreground">Documents available to the retrieval agents</p></div>
          <Button asChild variant="ghost" size="sm"><Link to="/app/knowledge">Knowledge base <ArrowRight /></Link></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-secondary/70 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Document</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Chunks</th><th className="px-5 py-3 font-medium">Added</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {DOCUMENTS.slice(0, 5).map((doc) => (
                <tr key={doc.id} className="transition-colors hover:bg-secondary/40"><td className="px-5 py-4 font-medium">{doc.name}</td><td className="px-5 py-4 text-muted-foreground">{doc.type} · {doc.size}</td><td className="px-5 py-4 tabular-nums text-muted-foreground">{doc.chunks}</td><td className="px-5 py-4 text-muted-foreground">{doc.uploaded}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-2 text-xs font-medium"><span className={`size-1.5 rounded-full ${doc.status === "ready" ? "bg-success" : "bg-warning"}`} />{doc.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}