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
import { Button } from "@/components/ui/button";

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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl">
        <div className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-4 px-5 sm:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Hexagon size={17} strokeWidth={1.8} /></span>
            <span className="font-display text-lg font-semibold">TrustRAG</span>
            <span className="hidden border-l border-border pl-3 text-xs text-muted-foreground sm:block">Workspace</span>
          </Link>

          <div className="relative ml-auto hidden w-full max-w-xs lg:block">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <input
              placeholder="Search documents, chunks, answers…"
              className="h-9 w-full rounded-md border border-border bg-secondary pl-9 text-sm outline-none transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative text-muted-foreground"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </Button>
            <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              MI
            </div>
          </div>
        </div>
        </div>

        <nav className="border-b border-border bg-secondary/45" aria-label="Workspace navigation">
          <div className="mx-auto flex h-12 w-full max-w-[1320px] gap-1 overflow-x-auto px-5 sm:px-8">
            {NAV.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? path === to : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-200",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1320px] min-w-0 flex-1 px-5 py-10 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}