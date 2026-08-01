import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Hexagon } from "lucide-react";
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

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-block border-l-2 border-white bg-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-white backdrop-blur-md">
      {children}
    </span>
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
                <span className="text-lg font-medium tracking-tight sm:text-xl">trustrag</span>
              </Link>
            </Reveal>
            <nav className="hidden items-center gap-8 md:flex lg:gap-10">
              {["Platform", "Evidence", "Research", "Contact"].map((label, i) => (
                <Reveal key={label} delay={100 + i * 100}>
                  <a
                    href="#capability"
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
        </main>
      </div>
    </div>
  );
}
