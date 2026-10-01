import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiClient } from "@/lib/api-client";
import { MonoLabel, PageHeader, Panel } from "@/components/app/Primitives";

export const Route = createFileRoute("/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TrustRAG Console" },
      {
        name: "description",
        content:
          "Configure the LLM, embedding model, chunk size, top-K retrieval, temperature and consensus threshold.",
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
  const [geminiKey, setGeminiKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [tavilyConfigured, setTavilyConfigured] = useState(false);
  const [model, setModel] = useState("gemini-3.8-flash");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(80);
  const [extSearch, setExtSearch] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getSettings()
      .then(({ settings }) => {
        setGeminiKey("");
        setTavilyKey("");
        setGeminiConfigured(Boolean(settings.gemini_api_key_configured));
        setTavilyConfigured(Boolean(settings.tavily_api_key_configured));
        setModel(settings.preferred_model || "gemini-3.8-flash");
        setTopK(settings.similarity_top_k ?? 5);
        setThreshold(settings.consensus_threshold ?? 80);
        setExtSearch(settings.enable_external_search ?? true);
      })
      .catch(() => {
        /* non-fatal: user can still set values */
      })
      .finally(() => setLoading(false));
  }, []);

  const applyTheme = (v: string) => {
    setTheme(v);
    document.documentElement.classList.toggle("dark", v === "dark");
  };

  const applyPreset = (preset: "strict" | "balanced" | "fast") => {
    if (preset === "strict") {
      setTopK(12);
      setThreshold(88);
    } else if (preset === "balanced") {
      setTopK(5);
      setThreshold(80);
    } else {
      setTopK(3);
      setThreshold(60);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        preferred_model: model,
        similarity_top_k: topK,
        consensus_threshold: threshold,
        enable_external_search: extSearch,
      };
      if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim();
      if (tavilyKey.trim()) payload.tavily_api_key = tavilyKey.trim();
      const response = await ApiClient.updateSettings(payload);
      setGeminiKey("");
      setTavilyKey("");
      setGeminiConfigured(Boolean(response.settings.gemini_api_key_configured));
      setTavilyConfigured(Boolean(response.settings.tavily_api_key_configured));
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTopK(5);
    setThreshold(80);
    setExtSearch(true);
    setModel("gemini-3.8-flash");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Tune the pipeline."
        description="These controls change how evidence is retrieved and how strictly agents must agree."
      />

      {/* Presets */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-secondary/30 p-4">
        <div>
          <p className="text-xs font-semibold">Pipeline Optimization Presets</p>
          <p className="text-[11px] text-muted-foreground">
            Tune retrieval and consensus for your use case.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["strict", "balanced", "fast"] as const).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:border-accent hover:text-accent"
            >
              {p === "strict"
                ? "⚖️ Strict Compliance"
                : p === "balanced"
                  ? "⚡ Balanced Default"
                  : "🚀 Fast Exploration"}
            </button>
          ))}
        </div>
      </div>

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
        <Row
          label="LLM model"
          hint="Inference is routed through the configured Gemini/OpenRouter AI service."
        >
          <select value={model} onChange={(e) => setModel(e.target.value)} className={selectCls}>
            <option value="gemini-3.8-flash">Gemini 3.8 Flash (Current)</option>
            <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
            <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
          </select>
        </Row>
      </Panel>

      <Panel className="animate-rise mt-4 px-5">
        <div className="pt-5 flex items-center justify-between">
          <MonoLabel>API Credentials</MonoLabel>
          <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Secrets stay encrypted
          </span>
        </div>
        <Row
          label="Google Gemini API Key"
          hint="Free from aistudio.google.com/app/apikey — no credit card."
        >
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza••••••••••••••••••••"
            className={selectCls}
          />
          {geminiConfigured && (
            <p className="mt-1 text-[11px] text-emerald-500">
              Configured. Leave blank to keep the current key.
            </p>
          )}
        </Row>
        <Row
          label="Tavily API Key (Optional)"
          hint="1,000 free searches/month for live fact-checking."
        >
          <input
            type="password"
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            placeholder="tvly-••••••••••••••••••••"
            className={selectCls}
          />
          {tavilyConfigured && (
            <p className="mt-1 text-[11px] text-emerald-500">
              Configured. Leave blank to keep the current key.
            </p>
          )}
        </Row>
        <Row
          label="External Web Search"
          hint="Cross-check answers against the live web via Tavily when confidence is low."
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={extSearch}
              onChange={(e) => setExtSearch(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-sm">{extSearch ? "Enabled" : "Disabled"}</span>
          </label>
        </Row>
      </Panel>

      <Panel className="animate-rise mt-4 px-5">
        <div className="pt-5">
          <MonoLabel>Retrieval &amp; Reasoning</MonoLabel>
        </div>
        <Row label="Top-K retrieval" hint="Chunks passed to the research agent per query.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">{topK}</span>
          </div>
        </Row>
        <Row
          label="Consensus threshold (%)"
          hint="Minimum agent agreement score (0–100) before an answer is accepted."
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="w-14 text-right font-mono text-xs tabular-nums">{threshold}%</span>
          </div>
        </Row>
      </Panel>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-300 hover:opacity-90 shadow-md active:scale-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
        <button
          onClick={handleReset}
          className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors duration-300 hover:bg-muted"
        >
          Reset to defaults
        </button>
        {saved && (
          <span className="animate-rise inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            ✓ Saved to backend
          </span>
        )}
      </div>
    </>
  );
}
