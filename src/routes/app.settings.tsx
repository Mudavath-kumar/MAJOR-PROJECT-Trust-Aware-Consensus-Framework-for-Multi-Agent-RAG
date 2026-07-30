import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TrustRAG Console" },
      {
        name: "description",
        content: "Configure the LLM, embedding model, chunk size, top-K retrieval, temperature and consensus threshold.",
      },
      { property: "og:title", content: "TrustRAG Settings" },
      { property: "og:description", content: "Tune retrieval, reasoning and consensus behaviour." },
    ],
  }),
  component: SettingsPage,
});

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-sm">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="w-full sm:w-64">{children}</div>
    </div>
  );
}

const selectCls =
  "h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm outline-none transition-colors duration-300 focus:border-foreground/25";

function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [chunk, setChunk] = useState(800);
  const [topK, setTopK] = useState(8);
  const [temp, setTemp] = useState(0.2);
  const [threshold, setThreshold] = useState(0.72);

  const applyTheme = (v: string) => {
    setTheme(v);
    document.documentElement.classList.toggle("dark", v === "dark");
  };

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Tune the pipeline."
        description="These controls change how documents are chunked, which evidence is retrieved, and how strictly agents must agree."
      />

      <Panel className="animate-rise px-5">
        <div className="pt-5">
          <MonoLabel>Workspace</MonoLabel>
        </div>
        <Row label="Theme" hint="Dark is the default cinematic surface.">
          <select value={theme} onChange={(e) => applyTheme(e.target.value)} className={selectCls}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Row>
        <Row label="LLM model" hint="Model used by the reasoning and research agents.">
          <select className={selectCls} defaultValue="gemini-3-flash">
            <option value="gemini-3-flash">Gemini 3 Flash</option>
            <option value="gemini-3-pro">Gemini 3 Pro</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
          </select>
        </Row>
        <Row label="Embedding model" hint="Vectoriser used at ingestion and query time.">
          <select className={selectCls} defaultValue="text-embedding-3-large">
            <option value="text-embedding-3-large">text-embedding-3-large</option>
            <option value="text-embedding-3-small">text-embedding-3-small</option>
            <option value="bge-m3">bge-m3</option>
          </select>
        </Row>
      </Panel>

      <Panel className="animate-rise mt-4 px-5">
        <div className="pt-5">
          <MonoLabel>Retrieval &amp; reasoning</MonoLabel>
        </div>
        <Row label="Chunk size" hint="Tokens per chunk at ingestion time.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={200}
              max={2000}
              step={50}
              value={chunk}
              onChange={(e) => setChunk(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">{chunk}</span>
          </div>
        </Row>
        <Row label="Top-K retrieval" hint="Chunks passed to the research agent per query.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={30}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">{topK}</span>
          </div>
        </Row>
        <Row label="Temperature" hint="Lower keeps answers close to the evidence.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temp}
              onChange={(e) => setTemp(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">{temp.toFixed(2)}</span>
          </div>
        </Row>
        <Row label="Consensus threshold" hint="Minimum agent agreement before an answer is shown.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">
              {threshold.toFixed(2)}
            </span>
          </div>
        </Row>
      </Panel>

      <div className="mt-6 flex gap-3">
        <button className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85">
          Save configuration
        </button>
        <button className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors duration-300 hover:bg-muted">
          Reset to defaults
        </button>
      </div>
    </>
  );
}