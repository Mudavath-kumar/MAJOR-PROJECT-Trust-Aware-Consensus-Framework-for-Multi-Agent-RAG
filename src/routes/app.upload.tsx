import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DOCUMENTS } from "@/lib/trustrag-data";
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
  progress: number;
  phase: "uploading" | "chunking" | "embedding" | "done" | "failed";
  chunks: number;
};

const PHASE_LABEL: Record<Job["phase"], string> = {
  uploading: "Uploading",
  chunking: "Chunking",
  embedding: "Embedding",
  done: "Indexed",
  failed: "No text found",
};

function UploadPage() {
  const { docs } = useKnowledgeStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setJobs((j) => [
        {
          id,
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          progress: 4,
          phase: "uploading",
          chunks: 0,
        },
        ...j,
      ]);

      void (async () => {
        const doc = await ingestFile(file);
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id
              ? { ...j, chunks: doc.chunkCount, phase: doc.parsed ? j.phase : "failed" }
              : j,
          ),
        );
      })();
    }
  }, []);

  // Visual ingestion progress (parsing itself is instant in the browser).
  useEffect(() => {
    if (!jobs.some((j) => j.phase !== "done" && j.phase !== "failed")) return;
    const t = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.phase === "done" || j.phase === "failed") return j;
          const progress = Math.min(100, j.progress + 6 + Math.random() * 10);
          const phase: Job["phase"] =
            progress >= 100
              ? "done"
              : progress > 70
                ? "embedding"
                : progress > 35
                  ? "chunking"
                  : "uploading";
          return { ...j, progress, phase };
        }),
      );
    }, 260);
    return () => clearInterval(t);
  }, [jobs]);

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
        className={`animate-rise p-1 transition-colors duration-300 ${dragging ? "border-foreground/40" : ""}`}
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center transition-colors duration-300 hover:bg-muted"
        >
          <UploadCloud size={28} className="text-accent" />
          <p className="mt-4 text-sm font-medium">Drop files here, or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF · DOCX · TXT · MD · CSV · JSON — parsed in your browser, nothing leaves the device
          </p>
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
          { label: "Documents indexed", value: docs.length },
          { label: "Chunks embedded", value: indexedChunks },
          {
            label: "Avg source trust",
            value: docs.length
              ? `${Math.round(docs.reduce((s, d) => s + d.trust, 0) / docs.length)}%`
              : "—",
          },
        ].map((s) => (
          <Panel key={s.label} className="animate-rise p-5">
            <MonoLabel>{s.label}</MonoLabel>
            <p className="mt-2 text-2xl font-normal tabular-nums">{s.value}</p>
          </Panel>
        ))}
      </div>

      {jobs.length > 0 && (
        <Panel className="animate-rise mt-6 p-5">
          <MonoLabel>Processing queue</MonoLabel>
          <ul className="mt-4 space-y-4">
            {jobs.map((j) => (
              <li key={j.id}>
                <div className="flex items-center gap-3">
                  {j.phase === "done" ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : j.phase === "failed" ? (
                    <AlertTriangle size={16} className="text-amber-500" />
                  ) : (
                    <Loader2 size={16} className="animate-spin text-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{j.name}</span>
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
                <Meter value={j.progress} className="mt-2" />
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
                        onClick={() => removeDoc(d.id)}
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

      <Panel className="animate-rise mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <MonoLabel>Sample corpus</MonoLabel>
          <span className="text-xs text-muted-foreground">{DOCUMENTS.length} files</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-border text-muted-foreground">
                {["Document", "Type", "Chunks", "Trust", "Uploaded", "Status"].map((h) => (
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
              {DOCUMENTS.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border transition-colors duration-300 last:border-0 hover:bg-muted"
                >
                  <td className="flex items-center gap-2 px-5 py-3">
                    <FileText size={14} className="text-muted-foreground" />
                    {d.name}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{d.type}</td>
                  <td className="px-5 py-3 tabular-nums">{d.chunks}</td>
                  <td className="px-5 py-3 tabular-nums">{d.trust ? `${d.trust}%` : "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{d.uploaded}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                        d.status === "ready"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
