import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Brain,
  ChevronRight,
  FileSearch,
  Hexagon,
  Layers,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrustRAG — Reliable AI through Trust, Evidence, and Consensus" },
      {
        name: "description",
        content:
          "Explainable multi-agent RAG over your documents. Every answer carries evidence, confidence, trust and consensus scores.",
      },
      { property: "og:title", content: "TrustRAG — Reliable AI you can audit" },
      {
        property: "og:description",
        content: "Multi-agent retrieval, verified evidence and transparent trust scoring on every answer.",
      },
    ],
  }),
  component: Landing,
});

const AGENTS = [
  {
    icon: FileSearch,
    name: "Research Agent",
    body: "Extracts relevant evidence and key information from the retrieved document chunks.",
  },
  {
    icon: ShieldCheck,
    name: "Fact Verification Agent",
    body: "Verifies factual correctness by cross-checking every claim against retrieved evidence.",
  },
  {
    icon: ScanSearch,
    name: "Trust Assessment Agent",
    body: "Scores source credibility using authority, reliability and freshness signals.",
  },
  {
    icon: Brain,
    name: "Reasoning Agent",
    body: "Detects contradictions, evaluates logical consistency and weighs supporting evidence.",
  },
];

const WORKFLOW = [
  "Upload one or more knowledge documents",
  "Documents are processed into text chunks",
  "Chunks are converted into vector embeddings",
  "Embeddings are stored in a vector database",
  "The user submits a natural language query",
  "Relevant chunks are retrieved via semantic search",
  "Multiple AI agents analyse the retrieved evidence",
  "The Adaptive Consensus Engine evaluates all agent outputs",
  "Low confidence triggers another retrieval and verification cycle",
  "The final answer is shown with evidence, citations and scores",
];

const FEATURES = [
  "Upload PDF, DOCX, TXT, Markdown and CSV documents",
  "Automatic document chunking and embedding generation",
  "Semantic document retrieval using vector search",
  "Natural language question-answering over your documents",
  "Multi-agent architecture for evidence validation",
  "Fact verification of retrieved information",
  "Trust assessment based on source credibility",
  "Logical reasoning and contradiction detection",
  "Adaptive consensus mechanism for answer validation",
  "Confidence score and trust score generation",
  "Evidence-backed responses with source citations",
  "Interactive evidence explorer and knowledge base",
  "Analytics dashboard for retrieval and response quality",
  "Configurable AI model and retrieval settings",
];

const APPLICATIONS = [
  "Research paper assistance",
  "Educational learning platforms",
  "Enterprise knowledge management",
  "Technical documentation search",
  "Legal document analysis",
  "Healthcare information retrieval",
  "Financial document intelligence",
  "Customer support knowledge bases",
  "Corporate policy assistants",
  "Internal organizational knowledge systems",
];

const OUTCOMES = [
  ["Improved accuracy", "Answers grounded in validated evidence rather than model memory."],
  ["Fewer hallucinations", "Unsupported claims are filtered out before generation."],
  ["Transparent decisions", "Every step of the reasoning chain is visible and inspectable."],
  ["Measurable trust", "Confidence and trust scores accompany each response."],
];

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </span>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Hexagon size={22} strokeWidth={1.5} className="text-accent" />
            <span className="text-lg font-medium tracking-tight">trustrag</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ["Problem", "#problem"],
              ["Agents", "#agents"],
              ["Workflow", "#workflow"],
              ["Features", "#features"],
              ["Applications", "#applications"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-sm text-muted-foreground transition-colors duration-300 hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <Link
            to="/app"
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85 sm:text-sm"
          >
            Open the platform
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        {/* Hero */}
        <section className="border-b border-border py-20 sm:py-28">
          <Reveal>
            <Eyebrow>Trust-aware multi-agent RAG</Eyebrow>
          </Reveal>
          <Reveal delay={120}>
            <h1 className="mt-4 max-w-3xl text-4xl leading-[1.08] font-normal tracking-tight sm:text-6xl">
              Evidence. Trust. Consensus.
            </h1>
          </Reveal>
          <Reveal delay={220}>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              TrustRAG is an AI-powered document intelligence platform that improves the
              reliability, transparency and explainability of LLM responses. Upload your research
              papers, reports, manuals or enterprise documents and ask questions in natural
              language — every answer arrives with supporting evidence, citations, confidence and
              trust scores.
            </p>
          </Reveal>
          <Reveal delay={320}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/app/chat"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85"
              >
                Ask your documents <ChevronRight size={15} />
              </Link>
              <Link
                to="/app/upload"
                className="rounded-full border border-border px-5 py-2.5 text-sm transition-colors duration-300 hover:bg-muted"
              >
                Upload a document
              </Link>
            </div>
          </Reveal>
          <Reveal delay={420}>
            <dl className="mt-14 grid gap-6 border-t border-border pt-8 sm:grid-cols-4">
              {[
                ["4", "Specialised agents"],
                ["5", "Supported file types"],
                ["2", "Reliability scores per answer"],
                ["1", "Adaptive consensus engine"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-3xl font-medium tabular-nums">{v}</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* Problem + solution */}
        <section id="problem" className="grid gap-10 border-b border-border py-20 md:grid-cols-2">
          <Reveal>
            <Eyebrow>The problem</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              Fluent answers are not the same as correct answers.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Large Language Models generate fluent, context-aware responses, but they still suffer
              from hallucinations, outdated knowledge and a lack of explainability. Retrieval-
              Augmented Generation helps, yet conventional RAG systems still retrieve irrelevant
              documents, surface conflicting evidence, rely on unreliable sources and hide their
              reasoning. Users receive answers without knowing whether the underlying information
              can be trusted — unacceptable in research, education, healthcare, legal and
              enterprise settings.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <Eyebrow>The solution</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              Validate the evidence before generating the answer.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              TrustRAG processes uploaded documents into searchable embeddings stored in a vector
              database. When a question arrives, the retriever selects the most relevant chunks and
              four specialised agents analyse them independently. Their findings pass to an
              Adaptive Consensus Engine, which computes a confidence score and decides whether the
              answer is reliable enough to return — or whether another retrieval and verification
              cycle is required.
            </p>
          </Reveal>
        </section>

        {/* Agents */}
        <section id="agents" className="border-b border-border py-20">
          <Reveal>
            <Eyebrow>Multi-agent architecture</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              Four agents, one verified answer.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {AGENTS.map((a, i) => (
              <Reveal key={a.name} delay={100 + i * 90}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 transition-colors duration-300 hover:bg-muted">
                  <a.icon size={20} className="text-accent" />
                  <h3 className="mt-4 text-base font-medium">{a.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={480}>
            <div className="mt-4 rounded-2xl border border-border bg-card p-6">
              <Layers size={20} className="text-accent" />
              <h3 className="mt-4 text-base font-medium">Adaptive Consensus Engine</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Combines the findings of all four agents into a single confidence score. If the
                score falls below the configured threshold, the framework runs another retrieval
                and verification cycle before the final response is produced.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Workflow */}
        <section id="workflow" className="border-b border-border py-20">
          <Reveal>
            <Eyebrow>System workflow</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              From upload to explained answer.
            </h2>
          </Reveal>
          <ol className="mt-10 grid gap-x-10 gap-y-1 sm:grid-cols-2">
            {WORKFLOW.map((step, i) => (
              <Reveal as="li" key={step} delay={60 * i}>
                <div className="flex gap-4 border-b border-border py-4">
                  <span className="font-mono text-[11px] tracking-[0.15em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm">{step}</span>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-border py-20">
          <Reveal>
            <Eyebrow>Key features</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              Everything the platform does.
            </h2>
          </Reveal>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal as="li" key={f} delay={40 * i}>
                <div className="flex h-full items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* Outcomes */}
        <section className="border-b border-border py-20">
          <Reveal>
            <Eyebrow>Expected outcomes</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              A framework you can defend.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {OUTCOMES.map(([title, body], i) => (
              <Reveal key={title} delay={90 * i}>
                <BarChart3 size={18} className="text-accent" />
                <h3 className="mt-3 text-sm font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Applications */}
        <section id="applications" className="border-b border-border py-20">
          <Reveal>
            <Eyebrow>Applications</Eyebrow>
            <h2 className="mt-3 text-2xl font-normal tracking-tight sm:text-3xl">
              Built for knowledge-intensive work.
            </h2>
          </Reveal>
          <div className="mt-8 flex flex-wrap gap-2">
            {APPLICATIONS.map((a, i) => (
              <Reveal key={a} delay={40 * i}>
                <span className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                  {a}
                </span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <Reveal>
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
              <h2 className="text-2xl font-normal tracking-tight sm:text-3xl">
                Ask your documents. Then check the working.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Transparent, trustworthy, evidence-driven answers — with the retrieval trail,
                verified claims and agent agreement shown alongside every response.
              </p>
              <Link
                to="/app"
                className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity duration-300 hover:opacity-85"
              >
                Open the console <ChevronRight size={15} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <Hexagon size={14} className="text-accent" /> TrustRAG
          </span>
          <span>Trust-aware multi-agent retrieval-augmented generation.</span>
        </div>
      </footer>
    </div>
  );
}
