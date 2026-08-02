import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Hexagon,
  Search,
  FileSearch,
  ShieldCheck,
  Users,
  Upload,
  MessageSquare,
  BarChart3,
  Scale,
  Stethoscope,
  Landmark,
  GraduationCap,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { ScrollVideo } from "@/components/ScrollVideo";

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

const SERVICES = ["/ MULTI-AGENT RAG", "/ EVIDENCE VERIFICATION", "/ TRUST SCORING"];

const CAPABILITIES = [
  {
    title: "Grounded retrieval",
    body: "Every claim is traced back to the exact chunk it came from, ranked by similarity and trust level.",
  },
  {
    title: "Layered verification",
    body: "A research agent drafts, a fact agent checks, and a trust agent scores before anything reaches you.",
  },
  {
    title: "Consensus engine",
    body: "Independent agents must agree. Disagreement is surfaced, never smoothed over.",
  },
];

const PIPELINE = [
  {
    icon: Upload,
    title: "Ingest",
    body: "Drop in PDFs, DOCX, TXT, MD, CSV or JSON. Text is extracted in your browser, split on sentence boundaries into ~700 character chunks and indexed locally.",
  },
  {
    icon: Search,
    title: "Retrieve",
    body: "Your question is tokenised and scored against every chunk with TF-IDF cosine similarity. The strongest passages become the working context.",
  },
  {
    icon: FileSearch,
    title: "Verify",
    body: "The fact agent re-reads each retrieved passage against the draft answer, flagging unsupported statements before they are shown.",
  },
  {
    icon: ShieldCheck,
    title: "Score",
    body: "Confidence, trust and consensus are computed per answer, with the evidence panel listing rank, similarity and source for every citation.",
  },
];

const AGENTS = [
  {
    icon: Search,
    name: "Retrieval agent",
    role: "Finds the passages that actually matter, filtered by the document scope you select.",
  },
  {
    icon: FileSearch,
    name: "Research agent",
    role: "Drafts an extractive answer and maps every sentence back to a numbered citation.",
  },
  {
    icon: ShieldCheck,
    name: "Fact agent",
    role: "Checks each claim against its evidence and downgrades anything thinly supported.",
  },
  {
    icon: Users,
    name: "Consensus agent",
    role: "Compares independent reads of the corpus and reports the level of agreement.",
  },
];

const USE_CASES = [
  { icon: Scale, title: "Legal review", body: "Search contracts and case files with a citation for every clause you rely on." },
  { icon: Stethoscope, title: "Clinical research", body: "Interrogate protocols and papers without losing the provenance of a single figure." },
  { icon: Landmark, title: "Finance & policy", body: "Turn filings, memos and regulation into answers your committee can defend." },
  { icon: GraduationCap, title: "Research teams", body: "Build a shared corpus and let the whole team ask it questions in plain language." },
];

const METRICS = [
  { v: "128", k: "Documents indexed" },
  { v: "1,394", k: "Questions answered" },
  { v: "91.2%", k: "Average trust score" },
  { v: "<2%", k: "Unsupported claims" },
];

const FAQ = [
  {
    q: "Where do my documents go?",
    a: "Nowhere. Parsing, chunking and retrieval all run in your browser and the index is kept in local storage on your machine.",
  },
  {
    q: "What does the trust score actually mean?",
    a: "It weights retrieval similarity against source authority and how many independent passages back the same claim.",
  },
  {
    q: "Which file types are supported?",
    a: "TXT, MD, CSV and JSON are parsed exactly; PDF and DOCX use a best-effort text decoder so you can still query them.",
  },
  {
    q: "Can I limit an answer to certain sources?",
    a: "Yes. The search scope control in the chat lets you restrict retrieval to any subset of your indexed documents.",
  },
];

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-block border-l-2 border-white bg-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-white backdrop-blur-md">
      {children}
    </span>
  );
}

function SectionHead({
  badge,
  title,
  lead,
}: {
  badge: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xl">
        <Reveal delay={80}>
          <Badge>{badge}</Badge>
        </Reveal>
        <Reveal delay={180}>
          <h2 className="mt-5 text-4xl font-normal leading-[1.08] tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
            {title}
          </h2>
        </Reveal>
      </div>
      <Reveal delay={280} className="max-w-sm sm:text-right">
        <p className="text-sm leading-relaxed text-white/80 drop-shadow-md sm:text-base">{lead}</p>
      </Reveal>
    </div>
  );
}

function Landing() {
  return (
    <div className="relative">
      <ScrollVideo />

      <div className="relative z-10">
        <header className="fixed top-0 left-0 z-50 w-full border-b border-white/15">
          <div className="flex items-center justify-between px-5 py-4 sm:px-8 md:px-12">
            <Reveal delay={0}>
              <Link to="/" className="flex items-center gap-2 text-white">
                <Hexagon size={24} strokeWidth={1.5} />
                <span className="text-lg font-medium tracking-tight sm:text-xl">TrustRAG</span>
              </Link>
            </Reveal>
            <nav className="hidden items-center gap-8 md:flex lg:gap-10">
              {[
                { label: "Platform", href: "#capability" },
                { label: "How it works", href: "#pipeline" },
                { label: "Agents", href: "#agents" },
                { label: "FAQ", href: "#faq" },
              ].map(({ label, href }, i) => (
                <Reveal key={label} delay={100 + i * 100}>
                  <a
                    href={href}
                    className="text-sm text-white/85 transition-colors duration-300 hover:text-white"
                  >
                    {label}
                    {label === "Platform" && (
                      <sup className="ml-0.5 font-mono text-[10px] text-white/60">6</sup>
                    )}
                  </a>
                </Reveal>
              ))}
            </nav>
            <Reveal delay={500}>
              <Link
                to="/app"
                className="rounded-md border border-white/20 bg-white/15 px-4 py-2 text-xs text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/25 sm:px-5 sm:text-sm"
              >
                Open the platform
              </Link>
            </Reveal>
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="flex min-h-screen flex-col justify-between px-5 pt-24 pb-12 sm:px-8 sm:pt-28 md:px-12 md:pb-16 supports-[height:100svh]:min-h-[100svh]">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <ul className="flex flex-col gap-2">
                {SERVICES.map((s, i) => (
                  <Reveal as="li" key={s} delay={150 + i * 120}>
                    <span className="font-mono text-xs uppercase tracking-[0.15em] text-white/90 drop-shadow-md">
                      {s}
                    </span>
                  </Reveal>
                ))}
              </ul>
              <Reveal delay={300} className="max-w-xs sm:text-right">
                <p className="text-lg leading-relaxed text-white drop-shadow-md sm:text-xl">
                  We build answers you can audit — grounded in your documents, scored for trust, and
                  explained step by step.
                </p>
              </Reveal>
            </div>

            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <Reveal delay={150} className="mb-5">
                  <Badge>Reliable AI through trust</Badge>
                </Reveal>
                <Reveal delay={280}>
                  <h1 className="text-5xl font-normal leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
                    Evidence. Trust.
                    <br />
                    Consensus.
                  </h1>
                </Reveal>
              </div>

              <Reveal delay={420}>
                <div className="w-full max-w-xs rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
                    Live pipeline
                  </span>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { k: "Confidence", v: "92%" },
                      { k: "Trust", v: "88%" },
                      { k: "Consensus", v: "76%" },
                    ].map((m) => (
                      <div key={m.k}>
                        <div className="text-lg font-medium tabular-nums text-white">{m.v}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/55">
                          {m.k}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/app/upload"
                    className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors duration-300 hover:bg-white/85"
                  >
                    Upload a document <ChevronRight size={14} />
                  </Link>
                </div>
              </Reveal>
            </div>
          </section>

          <div className="h-[80vh]" aria-hidden />

          {/* Capability */}
          <section
            id="capability"
            className="flex min-h-screen flex-col justify-between px-5 pt-24 pb-12 sm:px-8 sm:pt-28 md:px-12 md:pb-16 supports-[height:100svh]:min-h-[100svh]"
          >
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <Reveal delay={120}>
                <Badge>Insight on demand</Badge>
              </Reveal>
              <Reveal delay={220} className="max-w-sm sm:text-right">
                <p className="text-lg leading-relaxed text-white drop-shadow-md sm:text-xl">
                  TrustRAG doesn't just respond — it retrieves, verifies, scores, and shows its work.
                </p>
              </Reveal>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-12 md:flex-row md:items-end md:justify-between md:gap-16">
              <div className="max-w-xl">
                <Reveal delay={180}>
                  <h2 className="text-5xl font-normal leading-[1.05] tracking-tight text-white drop-shadow-lg sm:text-6xl lg:text-7xl">
                    Learn to see
                    <br />
                    brilliantly.
                  </h2>
                </Reveal>
                <Reveal delay={320}>
                  <p className="mt-6 max-w-md text-sm text-white/80 drop-shadow-md sm:text-base">
                    From the first upload to the final answer, TrustRAG turns raw documents into
                    decisions your team can defend — quietly, precisely, at speed.
                  </p>
                </Reveal>
                <Reveal delay={420}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to="/app/chat"
                      className="inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition-colors duration-300 hover:bg-white/85 sm:text-sm"
                    >
                      Run the demo <ChevronRight size={14} />
                    </Link>
                    <Link
                      to="/app"
                      className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/20 sm:text-sm"
                    >
                      Free consultation
                    </Link>
                  </div>
                </Reveal>
              </div>

              <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 px-5 backdrop-blur-md sm:px-6">
                {CAPABILITIES.map((c, i) => (
                  <Reveal
                    key={c.title}
                    delay={300 + i * 110}
                    className={i < CAPABILITIES.length - 1 ? "border-b border-white/15" : ""}
                  >
                    <div className="group flex gap-5 py-5">
                      <span className="font-mono text-[11px] tracking-[0.15em] text-white/55">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="flex items-center gap-1 text-base font-medium text-white sm:text-lg">
                          {c.title}
                          <ChevronRight
                            size={16}
                            className="text-white/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white"
                          />
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-white/70">{c.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="pipeline" className="px-5 py-24 sm:px-8 md:px-12 md:py-32">
            <SectionHead
              badge="How it works"
              title="Four steps from file to defensible answer."
              lead="Nothing leaves your machine. The whole pipeline — parsing, indexing, retrieval and scoring — runs in the browser."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE.map((s, i) => (
                <Reveal key={s.title} delay={120 + i * 100}>
                  <div className="h-full rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition-colors duration-300 hover:bg-white/15">
                    <div className="flex items-center justify-between">
                      <s.icon size={20} className="text-white" strokeWidth={1.5} />
                      <span className="font-mono text-[11px] tracking-[0.15em] text-white/50">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-medium text-white">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Agents */}
          <section id="agents" className="px-5 py-24 sm:px-8 md:px-12 md:py-32">
            <SectionHead
              badge="Multi-agent architecture"
              title="Four agents, one auditable answer."
              lead="Each agent has a single job and leaves a trace, so you can see exactly where an answer came from and where it was challenged."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {AGENTS.map((a, i) => (
                <Reveal key={a.name} delay={120 + i * 90}>
                  <div className="flex h-full gap-5 rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
                      <a.icon size={18} className="text-white" strokeWidth={1.5} />
                    </span>
                    <div>
                      <h3 className="text-base font-medium text-white sm:text-lg">{a.name}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/70">{a.role}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Evidence explorer */}
          <section id="evidence" className="px-5 py-24 sm:px-8 md:px-12 md:py-32">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <Reveal delay={80}>
                  <Badge>Evidence explorer</Badge>
                </Reveal>
                <Reveal delay={180}>
                  <h2 className="mt-5 text-4xl font-normal leading-[1.08] tracking-tight text-white drop-shadow-lg sm:text-5xl">
                    See the passage,
                    <br />
                    not just the claim.
                  </h2>
                </Reveal>
                <Reveal delay={280}>
                  <p className="mt-6 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
                    Every citation opens the exact chunk it came from — with its document, rank,
                    similarity score and trust level. Narrow retrieval to a subset of sources, then
                    export the whole transcript with its evidence attached.
                  </p>
                </Reveal>
                <Reveal delay={380}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to="/app/knowledge"
                      className="inline-flex items-center gap-1 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition-colors duration-300 hover:bg-white/85 sm:text-sm"
                    >
                      Browse the knowledge base <ChevronRight size={14} />
                    </Link>
                    <Link
                      to="/app/analytics"
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-xs text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/20 sm:text-sm"
                    >
                      <BarChart3 size={14} /> See analytics
                    </Link>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={200}>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:p-6">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
                    Retrieved evidence
                  </span>
                  <div className="mt-4 space-y-3">
                    {[
                      { doc: "Q3-risk-register.pdf", sim: "0.91", trust: "high" },
                      { doc: "vendor-msa-2026.docx", sim: "0.74", trust: "high" },
                      { doc: "board-notes-may.md", sim: "0.41", trust: "medium" },
                    ].map((e, i) => (
                      <div key={e.doc} className="rounded-xl border border-white/15 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm text-white">
                            <span className="font-mono text-[11px] text-white/50">[{i + 1}]</span>{" "}
                            {e.doc}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
                            {e.sim} · {e.trust}
                          </span>
                        </div>
                        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/15">
                          <div
                            className="h-full rounded-full bg-white"
                            style={{ width: `${Number(e.sim) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          {/* Metrics */}
          <section className="px-5 py-20 sm:px-8 md:px-12">
            <div className="grid gap-6 rounded-2xl border border-white/15 bg-white/10 p-8 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
              {METRICS.map((m, i) => (
                <Reveal key={m.k} delay={100 + i * 90}>
                  <div>
                    <div className="text-4xl font-normal tabular-nums text-white">{m.v}</div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">
                      {m.k}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Use cases */}
          <section id="use-cases" className="px-5 py-24 sm:px-8 md:px-12 md:py-32">
            <SectionHead
              badge="Where it fits"
              title="Built for work that has to hold up."
              lead="Anywhere an answer needs a source attached to it, TrustRAG gives you the paper trail by default."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map((u, i) => (
                <Reveal key={u.title} delay={120 + i * 90}>
                  <div className="h-full rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md transition-colors duration-300 hover:bg-white/15">
                    <u.icon size={20} className="text-white" strokeWidth={1.5} />
                    <h3 className="mt-5 text-base font-medium text-white sm:text-lg">{u.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{u.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="px-5 py-24 sm:px-8 md:px-12 md:py-32">
            <SectionHead
              badge="Questions"
              title="The details, plainly."
              lead="No backend, no data leaving the browser, and a score you can interrogate."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {FAQ.map((f, i) => (
                <Reveal key={f.q} delay={120 + i * 80}>
                  <div className="h-full rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
                    <h3 className="text-base font-medium text-white">{f.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{f.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="px-5 pb-24 sm:px-8 md:px-12">
            <Reveal>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-10 text-center backdrop-blur-md sm:p-16">
                <h2 className="text-4xl font-normal leading-[1.08] tracking-tight text-white drop-shadow-lg sm:text-5xl">
                  Upload a document.
                  <br />
                  Ask it anything.
                </h2>
                <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
                  Your corpus is indexed in seconds and every answer arrives with its evidence.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link
                    to="/app/upload"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition-colors duration-300 hover:bg-white/85"
                  >
                    <Upload size={15} /> Upload documents
                  </Link>
                  <Link
                    to="/app/chat"
                    className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/20"
                  >
                    <MessageSquare size={15} /> Open the chat
                  </Link>
                </div>
              </div>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-white/15 px-5 py-10 sm:px-8 md:px-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="flex items-center gap-2 text-white">
              <Hexagon size={20} strokeWidth={1.5} />
              <span className="text-base font-medium tracking-tight">TrustRAG</span>
            </Link>
            <nav className="flex flex-wrap gap-6">
              {[
                { label: "Dashboard", to: "/app" as const },
                { label: "Upload", to: "/app/upload" as const },
                { label: "Knowledge", to: "/app/knowledge" as const },
                { label: "Chat", to: "/app/chat" as const },
                { label: "Analytics", to: "/app/analytics" as const },
              ].map((l) => (
                <Link
                  key={l.label}
                  to={l.to}
                  className="text-sm text-white/70 transition-colors duration-300 hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/50">
              © 2026 TrustRAG
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
