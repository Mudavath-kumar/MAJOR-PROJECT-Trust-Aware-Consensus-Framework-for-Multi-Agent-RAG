import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, FileText, MessageSquare, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiClient } from "@/lib/api-client";
import { getChunks, removeDoc, type StoredDoc, useKnowledgeStore } from "@/lib/doc-store";
import { EmptyState, Meter, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/knowledge")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — TrustRAG Console" },
      {
        name: "description",
        content:
          "Search, filter, preview and inspect the chunks and metadata behind every indexed document.",
      },
      { property: "og:title", content: "TrustRAG Knowledge Base" },
      { property: "og:description", content: "Every chunk, its metadata and its trust level." },
    ],
  }),
  component: KnowledgeBase,
});

const FILTERS = ["all", "PDF", "DOCX", "TXT", "MD", "CSV", "JSON"] as const;

type IndexedChunk = {
  id: string;
  doc: string;
  page: number;
  similarity: number | null;
  text: string;
};

function KnowledgeBase() {
  const { docs: remoteDocs } = useKnowledgeStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [chunkQuery, setChunkQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<IndexedChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selected = remoteDocs.find((doc) => doc.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && remoteDocs.some((doc) => doc.id === selectedId)) return;
    setSelectedId(remoteDocs[0]?.id ?? null);
  }, [remoteDocs, selectedId]);

  useEffect(() => {
    if (!selected) {
      setChunks([]);
      return;
    }
    let cancelled = false;
    setChunksLoading(true);
    setChunksError(null);
    void ApiClient.getDocumentChunks(selected.id)
      .then(({ chunks: remoteChunks }) => {
        if (cancelled) return;
        if (remoteChunks && remoteChunks.length > 0) {
          setChunks(
            remoteChunks.map((chunk: any, index: number) => ({
              id: String(chunk.chunk_id ?? `${selected.id}-${index}`),
              doc: selected.name,
              page: Number(chunk.metadata?.page ?? 1),
              similarity: null,
              text: String(chunk.text ?? ""),
            })),
          );
        } else {
          // Fallback to local chunks
          const local = getChunks().filter((c) => c.docId === selected.id);
          setChunks(
            local.map((c) => ({
              id: c.id,
              doc: c.docName,
              page: c.page,
              similarity: null,
              text: c.text,
            })),
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          // Graceful fallback to locally indexed chunks
          const local = getChunks().filter((c) => c.docId === selected.id);
          if (local.length > 0) {
            setChunks(
              local.map((c) => ({
                id: c.id,
                doc: c.docName,
                page: c.page,
                similarity: null,
                text: c.text,
              })),
            );
          } else {
            setChunksError(error instanceof Error ? error.message : "Unable to load indexed chunks");
            setChunks([]);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setChunksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    remoteDocs.forEach((d) => (d.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [remoteDocs]);

  const docs = useMemo(
    () =>
      remoteDocs.filter(
        (d) =>
          (filter === "all" || d.type === filter) &&
          (!activeTag || d.tags?.includes(activeTag)) &&
          d.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [remoteDocs, query, filter, activeTag],
  );

  const displayedChunks = useMemo(() => {
    if (!chunkQuery.trim()) return chunks;
    const q = chunkQuery.toLowerCase();
    return chunks.filter(
      (c) => c.text.toLowerCase().includes(q) || c.doc.toLowerCase().includes(q),
    );
  }, [chunks, chunkQuery]);

  const copyChunk = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const deleteDocument = async (document: StoredDoc) => {
    setDeletingId(document.id);
    try {
      await removeDoc(document.id);
      if (selectedId === document.id) setSelectedId(null);
    } catch (error) {
      setChunksError(error instanceof Error ? error.message : "Unable to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Corpus"
        title="Know what the model knows."
        description="Inspect indexed documents down to individual chunks — with similarity, trust level and provenance metadata."
        action={
          <Link
            to="/app/upload"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            Upload new documents
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel className="animate-rise p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents…"
                className="h-9 w-full rounded-lg border border-border bg-muted pl-9 pr-3 text-sm outline-none transition-colors duration-300 focus:border-foreground/25"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-300 ${
                    filter === f
                      ? "bg-secondary text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Tag pills */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
              Tags:
            </span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] transition-all ${
                  activeTag === t
                    ? "bg-accent/20 text-accent font-medium border border-accent/40"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                #{t}
              </button>
            ))}
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="text-[10px] text-muted-foreground underline hover:text-foreground ml-1"
              >
                Clear tag
              </button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {docs.length === 0 && (
              <EmptyState
                title="No documents match"
                hint="Try a different search term or filter."
              />
            )}
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`group flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                  selected?.id === d.id
                    ? "border-accent/50 bg-secondary/80 shadow-xs"
                    : "border-border hover:border-accent/30 hover:bg-muted/50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    selected?.id === d.id
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <FileText size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[9px] uppercase text-muted-foreground">
                      {d.type}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {d.chunkCount} chunks · {d.status ?? "unknown"} · {d.trust}% trust
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete ${d.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteDocument(d);
                  }}
                  className="p-1.5 text-muted-foreground/60 transition-colors duration-200 hover:text-destructive"
                >
                  {deletingId === d.id ? "…" : <Trash2 size={14} />}
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="animate-rise p-5">
          {!selected ? (
            <EmptyState
              title="No document selected"
              hint="Pick a document to preview its chunks."
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <MonoLabel>Document details</MonoLabel>
                <Link
                  to="/app/chat"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-all"
                >
                  <MessageSquare size={13} /> Chat with doc
                </Link>
              </div>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">{selected.name}</h2>
              <dl className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
                {[
                  ["Type", selected.type],
                  ["Size", selected.sizeLabel],
                  ["Chunks", String(selected.chunkCount)],
                  ["Status", selected.status ?? "unknown"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Source trust index
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-emerald-400">
                    {selected.trust}%
                  </span>
                </div>
                <Meter value={selected.trust} className="mt-2" />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(selected.tags ?? []).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <MonoLabel>Indexed Chunks ({chunks.length})</MonoLabel>
                  <div className="relative w-44">
                    <input
                      value={chunkQuery}
                      onChange={(e) => setChunkQuery(e.target.value)}
                      placeholder="Filter chunks…"
                      className="h-7 w-full rounded-md border border-border bg-muted px-2 text-xs outline-none focus:border-foreground/30"
                    />
                  </div>
                </div>

                {chunksLoading && (
                  <p className="mt-3 text-xs text-muted-foreground">Loading indexed chunks…</p>
                )}
                {chunksError && <p className="mt-3 text-xs text-destructive">{chunksError}</p>}
                <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
                  {!chunksLoading && !chunksError && displayedChunks.length === 0 && (
                    <p className="text-xs text-muted-foreground">No indexed chunks found.</p>
                  )}
                  {displayedChunks.map((c) => (
                    <div
                      key={c.id}
                      className="group relative rounded-xl border border-border/80 bg-secondary/20 p-3 transition-colors hover:border-accent/40 hover:bg-secondary/40"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                          {c.doc} · p.{c.page}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-accent font-semibold">
                            {c.similarity === null ? "indexed" : `sim ${c.similarity.toFixed(2)}`}
                          </span>
                          <button
                            onClick={() => copyChunk(c.id, c.text)}
                            title="Copy chunk text"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {copiedId === c.id ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                        {c.text}
                      </p>
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
