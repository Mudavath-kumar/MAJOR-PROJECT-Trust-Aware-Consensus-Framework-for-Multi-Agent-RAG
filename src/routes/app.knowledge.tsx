import { createFileRoute } from "@tanstack/react-router";
import { FileText, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CHUNKS, DOCUMENTS, type TrustDoc } from "@/lib/trustrag-data";
import { EmptyState, Meter, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — TrustRAG Console" },
      {
        name: "description",
        content: "Search, filter, preview and inspect the chunks and metadata behind every indexed document.",
      },
      { property: "og:title", content: "TrustRAG Knowledge Base" },
      { property: "og:description", content: "Every chunk, its metadata and its trust level." },
    ],
  }),
  component: KnowledgeBase,
});

const FILTERS = ["all", "PDF", "DOCX", "TXT", "MD"] as const;

function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [removed, setRemoved] = useState<string[]>([]);
  const [selected, setSelected] = useState<TrustDoc | null>(DOCUMENTS[0]);

  const docs = useMemo(
    () =>
      DOCUMENTS.filter(
        (d) =>
          !removed.includes(d.id) &&
          (filter === "all" || d.type === filter) &&
          d.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, filter, removed],
  );

  return (
    <>
      <PageHeader
        eyebrow="Corpus"
        title="Know what the model knows."
        description="Inspect indexed documents down to individual chunks — with similarity, trust level and provenance metadata."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel className="animate-rise p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="h-9 w-full rounded-lg border border-border bg-white/5 pl-9 text-sm outline-none transition-colors duration-300 focus:border-white/25"
              />
            </div>
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-300 ${
                    filter === f ? "bg-white/15 text-foreground" : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {docs.length === 0 && (
              <EmptyState title="No documents match" hint="Try a different search term or filter." />
            )}
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-300 ${
                  selected?.id === d.id ? "border-white/25 bg-white/10" : "border-border hover:bg-white/5"
                }`}
              >
                <FileText size={16} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {d.type} · {d.chunks} chunks · {d.uploaded}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${d.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemoved((r) => [...r, d.id]);
                    if (selected?.id === d.id) setSelected(null);
                  }}
                  className="text-muted-foreground transition-colors duration-300 hover:text-destructive"
                >
                  <Trash2 size={14} />
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="animate-rise p-5">
          {!selected ? (
            <EmptyState title="No document selected" hint="Pick a document to preview its chunks." />
          ) : (
            <>
              <MonoLabel>Document details</MonoLabel>
              <h2 className="mt-2 text-lg font-medium">{selected.name}</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Type", selected.type],
                  ["Size", selected.size],
                  ["Chunks", String(selected.chunks)],
                  ["Uploaded", selected.uploaded],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border px-3 py-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="mt-1">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <MonoLabel>Source trust</MonoLabel>
                  <span className="text-xs tabular-nums">{selected.trust}%</span>
                </div>
                <Meter value={selected.trust} className="mt-2" />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {selected.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-6">
                <MonoLabel>Chunk viewer</MonoLabel>
                <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
                  {CHUNKS.map((c) => (
                    <div key={c.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        <span>
                          {c.doc} · p.{c.page}
                        </span>
                        <span>sim {c.similarity.toFixed(2)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}