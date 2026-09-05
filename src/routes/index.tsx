import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileSearch,
  FileText,
  GraduationCap,
  Hexagon,
  Landmark,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  Stethoscope,
  Upload,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TrustRAG — Evidence-first AI for your documents" },
      { name: "description", content: "Ask your documents questions and get evidence-backed answers with confidence, trust and consensus scores." },
      { property: "og:title", content: "TrustRAG — Evidence-first AI" },
      { property: "og:description", content: "Explainable multi-agent answers grounded in your documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  { icon: Upload, step: "01", title: "Ingest", body: "Add PDF, DOCX, TXT, MD, CSV or JSON files. TrustRAG extracts and prepares the content for retrieval." },
  { icon: Search, step: "02", title: "Retrieve", body: "Each question is matched against your indexed sources to find the passages that matter most." },
  { icon: FileSearch, step: "03", title: "Verify", body: "Independent agents check the draft against the retrieved passages and flag weak support." },
  { icon: ShieldCheck, step: "04", title: "Score", body: "Every answer ships with confidence, trust and consensus scores, plus its exact citations." },
];

const AGENTS = [
  [Search, "Retrieval agent", "Finds and ranks the most relevant passages in the sources you selected."],
  [FileSearch, "Research agent", "Builds a concise answer and maps each material claim to its citation."],
  [ShieldCheck, "Fact agent", "Challenges the draft and reduces confidence where the evidence is weak."],
  [Users, "Consensus agent", "Compares independent reads and makes disagreement visible instead of hiding it."],
] as const;

const USE_CASES = [
  [Scale, "Legal", "Review contracts and case files with a source attached to every clause."],
  [Stethoscope, "Clinical", "Interrogate protocols and research without losing the provenance of a figure."],
  [Landmark, "Finance", "Turn filings, policy and internal memos into answers a committee can defend."],
  [GraduationCap, "Research", "Give a team one shared, searchable corpus with transparent evidence."],
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="TrustRAG home">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Hexagon size={17} strokeWidth={1.8} /></span>
      <span className="font-display text-lg font-semibold">TrustRAG</span>
    </Link>
  );
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end lg:gap-16">
      <Reveal>
        <p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p>
        <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">{title}</h2>
      </Reveal>
      <Reveal delay={100}><p className="text-base leading-7 text-muted-foreground">{copy}</p></Reveal>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center px-5 sm:px-8">
          <Brand />
          <nav className="mx-auto hidden items-center gap-7 md:flex" aria-label="Main navigation">
            <a href="#platform" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Platform</a>
            <a href="#workflow" className="text-sm text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#agents" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Agents</a>
            <a href="#use-cases" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Use cases</a>
          </nav>
          <Button asChild size="sm" className="ml-auto">
            <Link to="/app">Open workspace <ArrowRight /></Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-background">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1320px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:py-20">
            <Reveal>
              <div className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                <span className="size-1.5 rounded-full bg-success" /> Evidence-first multi-agent RAG
              </div>
              <h1 className="mt-7 max-w-3xl font-display text-5xl font-semibold leading-[1.04] sm:text-6xl lg:text-7xl">
                Answers your team can verify.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Ask questions across your documents. TrustRAG retrieves the evidence, checks every claim and shows exactly why the answer deserves your trust.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg"><Link to="/app/upload"><Upload /> Add your documents</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/app/chat"><MessageSquare /> Try the workspace</Link></Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                {['Private in your browser', 'Citations by default', 'No black-box scores'].map((item) => (
                  <span key={item} className="flex items-center gap-2"><Check size={15} className="text-success" />{item}</span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={120} className="lg:pl-6">
              <div className="border border-border bg-card shadow-xl shadow-shadow/50">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div><p className="text-sm font-semibold">Verified answer</p><p className="mt-0.5 text-xs text-muted-foreground">3 sources · 4 agents</p></div>
                  <span className="flex items-center gap-2 text-xs font-medium text-success"><span className="size-1.5 rounded-full bg-success" /> Complete</span>
                </div>
                <div className="p-5 sm:p-7">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Question</p>
                  <p className="mt-2 font-display text-xl font-semibold">What are the main renewal risks in our vendor agreements?</p>
                  <div className="mt-6 border-l-2 border-primary pl-4 text-sm leading-7 text-foreground">
                    Three contracts contain automatic renewal clauses with notice windows under 30 days. Two also permit annual price increases without a stated cap <span className="font-semibold text-primary">[1][2]</span>.
                  </div>
                  <div className="mt-7 grid grid-cols-3 border-y border-border">
                    {[["Confidence","92%"],["Trust","88%"],["Consensus","84%"]].map(([k,v], i) => (
                      <div key={k} className={`py-4 ${i ? 'border-l border-border pl-4' : ''}`}><div className="text-2xl font-semibold tabular-nums">{v}</div><div className="mt-1 text-xs text-muted-foreground">{k}</div></div>
                    ))}
                  </div>
                  <div className="mt-5 space-y-3">
                    {[['01','vendor-msa-2026.docx','91%'],['02','procurement-policy.pdf','78%']].map(([n,doc,score]) => (
                      <div key={doc} className="flex items-center gap-3 border-b border-border pb-3 text-sm last:border-0 last:pb-0"><span className="font-mono text-xs text-muted-foreground">{n}</span><FileText size={15} className="text-primary"/><span className="min-w-0 flex-1 truncate">{doc}</span><span className="text-xs font-medium text-muted-foreground">{score} match</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-b border-border bg-secondary/55">
          <div className="mx-auto grid max-w-[1320px] grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
            {[['128','Documents indexed'],['1,394','Questions answered'],['91.2%','Average trust'],['<2%','Unsupported claims']].map(([v,k], i) => (
              <div key={k} className={`py-8 lg:py-10 ${i % 2 ? 'border-l border-border pl-6' : ''} ${i > 1 ? 'border-t border-border lg:border-t-0 lg:border-l lg:pl-8' : ''}`}><div className="font-display text-3xl font-semibold tabular-nums">{v}</div><div className="mt-1 text-sm text-muted-foreground">{k}</div></div>
            ))}
          </div>
        </section>

        <section id="platform" className="border-b border-border bg-background py-24 sm:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <SectionTitle eyebrow="The platform" title="One clear chain from question to evidence." copy="Most AI tools give you a polished paragraph. TrustRAG gives you the answer, the underlying passages, and a record of how multiple agents reached agreement." />
            <div className="mt-16 grid border-y border-border md:grid-cols-3">
              {[['Grounded retrieval','Every claim links to the exact document passage that supports it.'],['Layered verification','Research and fact agents challenge one another before the answer reaches you.'],['Visible consensus','Agent disagreement lowers the score and stays visible for review.']].map(([title, body], i) => (
                <Reveal key={title} delay={i*80} className={`py-8 md:px-8 ${i ? 'border-t border-border md:border-l md:border-t-0' : ''}`}><span className="font-mono text-xs text-primary">0{i+1}</span><h3 className="mt-8 font-display text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-border bg-secondary/55 py-24 sm:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <SectionTitle eyebrow="How it works" title="From file to defensible answer in four steps." copy="The entire workflow is visible. You can inspect the source scope, follow each agent and open every cited passage." />
            <div className="mt-16 divide-y divide-border border-y border-border">
              {PIPELINE.map(({icon: Icon,step,title,body}, i) => (
                <Reveal key={title} delay={i*60} className="grid gap-4 py-7 sm:grid-cols-[64px_220px_1fr] sm:items-center"><span className="font-mono text-xs text-muted-foreground">{step}</span><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center border border-border bg-card text-primary"><Icon size={17}/></span><h3 className="font-display text-lg font-semibold">{title}</h3></div><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p></Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="agents" className="border-b border-border bg-background py-24 sm:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <SectionTitle eyebrow="Multi-agent architecture" title="Specialists that check each other’s work." copy="Each agent has one job, one output and a visible place in the execution timeline." />
            <div className="mt-16 grid border border-border md:grid-cols-2">
              {AGENTS.map(([Icon,title,body], i) => <Reveal key={title} delay={i*70} className={`flex gap-5 p-7 sm:p-9 ${i%2 ? 'md:border-l md:border-border' : ''} ${i>1 ? 'border-t border-border' : i===1 ? 'border-t border-border md:border-t-0' : ''}`}><Icon className="mt-1 shrink-0 text-primary" size={20}/><div><h3 className="font-display text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div></Reveal>)}
            </div>
          </div>
        </section>

        <section id="use-cases" className="border-b border-border bg-secondary/55 py-24 sm:py-32">
          <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
            <SectionTitle eyebrow="Use cases" title="For decisions that need a paper trail." copy="Use TrustRAG anywhere the quality of the source matters as much as the speed of the answer." />
            <div className="mt-16 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {USE_CASES.map(([Icon,title,body], i) => <Reveal key={title} delay={i*60} className="bg-background p-7"><Icon size={20} className="text-primary"/><h3 className="mt-8 font-display text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></Reveal>)}
            </div>
          </div>
        </section>

        <section className="bg-primary py-20 text-primary-foreground">
          <Reveal className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center">
            <div><p className="text-sm text-primary-foreground/70">Start with your own sources</p><h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold sm:text-5xl">Upload a document. Ask it anything.</h2></div>
            <Button asChild size="lg" variant="secondary"><Link to="/app/upload">Open TrustRAG <ArrowRight /></Link></Button>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand/><div className="flex items-center gap-6 text-sm text-muted-foreground"><Link to="/app">Workspace</Link><Link to="/app/knowledge">Knowledge</Link><Link to="/app/analytics"><BarChart3 className="inline size-4"/> Analytics</Link></div><p className="text-xs text-muted-foreground">© 2026 TrustRAG</p></div>
      </footer>
    </div>
  );
}