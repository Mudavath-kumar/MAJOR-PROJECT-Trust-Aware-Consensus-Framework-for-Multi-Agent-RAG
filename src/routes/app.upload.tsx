import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DOCUMENTS } from "@/lib/trustrag-data";
import { Meter, MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/upload")({
  head: () => ({
    meta: [
      { title: "Upload Documents — TrustRAG Console" },
      {
        name: "description",
        content: "Drag and drop PDF, DOCX, TXT or Markdown files and watch chunking and embedding progress live.",
      },
      { property: "og:title", content: "Upload documents to TrustRAG" },
      { property: "og:description", content: "Chunking, embedding and metadata status for every upload." },
    ],
  }),
  component: UploadPage,
});

type Job = {
  id: string;
  name: string;
  size: string;
  progress: number;
  phase: "uploading" | "chunking" | "embedding" | "done";
  chunks: number;
};

const PHASE_LABEL: Record<Job["phase"], string> = {
  uploading: "Uploading",
  chunking: "Chunking",
  embedding: "Embedding",
  done: "Indexed",
};

function UploadPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const next: Job[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
      progress: 0,
      phase: "uploading",
      chunks: 0,
    }));
    setJobs((j) => [...next, ...j]);
  }, []);

  useEffect(() => {
    if (!jobs.some((j) => j.phase !== "done")) return;
    const t = setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.phase === "done") return j;
          const progress = Math.min(100, j.progress + 4 + Math.random() * 8);
          const phase: Job["phase"] =
            progress >= 100 ? "done" : progress > 70 ? "embedding" : progress > 35 ? "chunking" : "uploading";
          return {
            ...j,
            progress,
            phase,
            chunks: phase === "uploading" ? 0 : Math.round((progress / 100) * 180),
          };
        }),
      );
    }, 350);
    return () => clearInterval(t);
  }, [jobs]);

  return (
    <>
      <PageHeader
        eyebrow="Ingestion"
        title="Give the agents something to read."
        description="PDF, DOCX, TXT and Markdown. Files are chunked, embedded and scored for source authority before they enter retrieval."
      />

      <Panel
        className={`animate-rise p-1 transition-colors duration-300 ${dragging ? "border-white/40" : ""}`}
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
          <p className="mt-1 text-xs text-muted-foreground">PDF · DOCX · TXT · MD — up to 50 MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </Panel>

      {jobs.length > 0 && (
        <Panel className="animate-rise mt-6 p-5">
          <MonoLabel>Processing queue</MonoLabel>
          <ul className="mt-4 space-y-4">
            {jobs.map((j) => (
              <li key={j.id}>
                <div className="flex items-center gap-3">
                  {j.phase === "done" ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
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

      <Panel className="animate-rise mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <MonoLabel>Uploaded documents</MonoLabel>
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