import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BarChart3,
  Bot,
  Database,
  Hexagon,
  LayoutDashboard,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "TrustRAG Console — Evidence-first AI workspace" },
      {
        name: "description",
        content:
          "Upload documents, query your knowledge base and inspect trust, confidence and consensus scores in the TrustRAG console.",
      },
      { property: "og:title", content: "TrustRAG Console" },
      { property: "og:description", content: "Evidence-first multi-agent RAG workspace." },
    ],
  }),
  component: AppShell,
});

type NavItem = {
  to: "/app" | "/app/chat" | "/app/upload" | "/app/knowledge" | "/app/analytics" | "/app/settings";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/chat", label: "AI Chat", icon: Bot },
  { to: "/app/upload", label: "Upload Documents", icon: Upload },
  { to: "/app/knowledge", label: "Knowledge Base", icon: Database },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* ambient cinematic wash, matches the landing page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -8%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 70%), radial-gradient(700px 420px at 88% 8%, color-mix(in oklab, var(--color-foreground) 7%, transparent), transparent 70%)",
        }}
      />
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Hexagon size={22} strokeWidth={1.5} className="text-accent" />
            <span className="text-lg font-medium tracking-tight">TrustRAG</span>
            <span className="ml-1 hidden rounded-full border border-border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase sm:inline">
              Console
            </span>
          </Link>

          <div className="relative ml-auto hidden w-full max-w-xs lg:block">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <input
              placeholder="Search documents, chunks, answers…"
              className="h-9 w-full rounded-lg border border-border bg-muted pl-9 text-sm outline-none transition-colors duration-300 placeholder:text-muted-foreground focus:border-foreground/30"
            />
          </div>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <button
              aria-label="Notifications"
              className="relative rounded-md p-2 text-muted-foreground transition-colors duration-300 hover:bg-muted hover:text-foreground"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-xs font-medium">
              MI
            </div>
          </div>
        </div>

        <nav className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="-mb-px flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors duration-300",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}