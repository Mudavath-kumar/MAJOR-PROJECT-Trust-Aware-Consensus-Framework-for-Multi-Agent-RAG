import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ingestFile, removeDoc, useKnowledgeStore } from "@/lib/doc-store";
import { Meter, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/upload")({
  head: () => ({
    meta: [
      { title: "Upload Documents — TrustRAG Console" },
      {
        name: "description",
        content:
          "Drag and drop PDF, DOCX, TXT or Markdown files, watch chunking and embedding, then chat with them instantly.",
      },
      { property: "og:title", content: "Upload documents to TrustRAG" },
      {
        property: "og:description",
        content: "Chunking, embedding and metadata status for every upload.",
      },
    ],
  }),
  component: UploadPage,
});

type Job = {
  id: string;
  name: string;
  size: string;
  progress: number | null;
  phase: "uploading" | "chunking" | "embedding" | "done" | "failed";
  chunks: number;
};

const PHASE_LABEL: Record<Job["phase"], string> = {
  uploading: "Uploading",
  chunking: "Chunking",
  embedding: "Embedding",
  done: "Indexed",
  failed: "Indexing failed",
};

function UploadPage() {
  const { docs, refresh } = useKnowledgeStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        const id = crypto.randomUUID();
        setJobs((j) => [
          {
            id,
            name: file.name,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            progress: null,
            phase: "uploading",
            chunks: 0,
          },
          ...j,
        ]);

        void (async () => {
          try {
            const doc = await ingestFile(file);
            refresh();
            setJobs((prev) =>
              prev.map((j) =>
                j.id === id
                  ? {
                      ...j,
                      progress: 100,
                      chunks: doc.chunkCount,
                      phase: doc.parsed ? "done" : "failed",
                    }
                  : j,
              ),
            );
          } catch (error) {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === id ? { ...j, progress: 100, phase: "failed", chunks: 0 } : j,
              ),
            );
            console.error("Document upload failed", error);
          }
        })();
      }
    },
    [refresh],
  );

  const indexedChunks = docs.reduce((s, d) => s + d.chunkCount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Ingestion"
        title="Give the agents something to read."
        description="PDF, DOCX, TXT and Markdown. Files are parsed, chunked, embedded and scored for source authority — then they're instantly available in chat."
        action={
          <Link
            to="/app/chat"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85"
          >
            <MessageSquare size={14} /> Chat with these documents
          </Link>
        }
      />

      <Panel
        className={`animate-rise p-1 transition-all duration-300 ${
          dragging ? "border-accent shadow-[0_0_0_3px_rgba(var(--color-accent)/0.15)]" : ""
        }`}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center transition-all duration-300 ${
            dragging
              ? "border-accent bg-accent/5"
              : "border-border hover:border-accent/40 hover:bg-muted/40"
          }`}
        >
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 transition-transform duration-300 ${
              dragging ? "scale-110" : "hover:scale-105"
            }`}
          >
            <UploadCloud size={26} className="text-accent" />
          </div>
          <p className="mt-4 text-sm font-semibold">Drop files here, or click to browse</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            PDF · DOCX · TXT · MD · CSV · JSON — processed by the backend AI pipeline
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["PDF", "DOCX", "Markdown", "TXT", "JSON", "CSV"].map((fmt) => (
              <span
                key={fmt}
                className="rounded-md border border-border/60 bg-muted/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {fmt}
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Documents indexed", value: docs.length, icon: FileText },
          { label: "Chunks embedded", value: indexedChunks, icon: MessageSquare },
          {
            label: "Avg source trust",
            value: docs.length
              ? `${Math.round(docs.reduce((s, d) => s + (d.trust ?? 0), 0) / docs.length)}%`
              : "—",
            icon: ShieldCheck,
          },
        ].map((s) => (
          <Panel key={s.label} className="animate-rise p-5">
            <div className="flex items-center justify-between">
              <MonoLabel>{s.label}</MonoLabel>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                <s.icon size={14} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Panel>
        ))}
      </div>

      {jobs.length > 0 && (
        <Panel className="animate-rise mt-6 p-5">
          <MonoLabel>Processing queue</MonoLabel>
          <ul className="mt-4 space-y-3">
            {jobs.map((j) => (
              <li
                key={j.id}
                className={`rounded-xl border-l-2 bg-muted/30 p-3 ${
                  j.phase === "done"
                    ? "border-emerald-500"
                    : j.phase === "failed"
                      ? "border-amber-400"
                      : "border-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  {j.phase === "done" ? (
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  ) : j.phase === "failed" ? (
                    <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                  ) : (
                    <Loader2 size={16} className="shrink-0 animate-spin text-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{j.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {PHASE_LABEL[j.phase]} · {j.chunks} chunks · {j.size}
                  </span>
                  <button
                    aria-label="Remove"
                    onClick={() => setJobs((p) => p.filter((x) => x.id !== j.id))}
                    className="text-muted-foreground transition-colors duration-300 hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
                {j.progress !== null && <Meter value={j.progress} className="mt-2" />}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {docs.length > 0 && (
        <Panel className="animate-rise mt-6 overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <MonoLabel>Your knowledge base</MonoLabel>
            <span className="text-xs text-muted-foreground">{docs.length} files</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-y border-border text-muted-foreground">
                  {["Document", "Type", "Chunks", "Trust", "Size", ""].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.15em]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-border transition-colors duration-300 last:border-0 hover:bg-muted"
                  >
                    <td className="flex items-center gap-2 px-5 py-3">
                      <FileText size={14} className="text-muted-foreground" />
                      <span className="max-w-[280px] truncate">{d.name}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{d.type}</td>
                    <td className="px-5 py-3 tabular-nums">{d.chunkCount}</td>
                    <td className="px-5 py-3 tabular-nums">{d.trust ? `${d.trust}%` : "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{d.sizeLabel}</td>
                    <td className="px-5 py-3">
                      <button
                        aria-label={`Remove ${d.name}`}
                        onClick={() => {
                          void removeDoc(d.id).catch((error) => {
                            console.error("Document deletion failed", error);
                          });
                        }}
                        className="text-muted-foreground transition-colors duration-300 hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
