import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  BarChart3,
  Bot,
  Database,
  Hexagon,
  LayoutDashboard,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sun,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar/70 backdrop-blur-xl transition-[width] duration-300 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-4">
          <Hexagon size={24} strokeWidth={1.5} className="shrink-0 text-accent" />
          {!collapsed && <span className="text-lg font-medium tracking-tight">trustrag</span>}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-4">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? path === to : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-300",
                  active
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
        {!collapsed && (
          <div className="m-3 rounded-xl border border-border bg-white/5 p-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Consensus
            </span>
            <p className="mt-1.5 text-xs text-muted-foreground">
              3 agents online · threshold 0.72
            </p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="rounded-md p-2 text-muted-foreground transition-colors duration-300 hover:bg-white/5 hover:text-foreground"
          >
            <PanelLeft size={18} />
          </button>
          <Link to="/" className="flex items-center gap-2 md:hidden">
            <Hexagon size={20} strokeWidth={1.5} className="text-accent" />
          </Link>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <input
              placeholder="Search documents, chunks, answers…"
              className="h-9 w-full rounded-lg border border-border bg-white/5 pl-9 text-sm outline-none transition-colors duration-300 placeholder:text-muted-foreground focus:border-white/25"
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              aria-label="Notifications"
              className="relative rounded-md p-2 text-muted-foreground transition-colors duration-300 hover:bg-white/5 hover:text-foreground"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
            <button
              aria-label="Toggle theme"
              onClick={() => setDark((d) => !d)}
              className="rounded-md p-2 text-muted-foreground transition-colors duration-300 hover:bg-white/5 hover:text-foreground"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white/10 text-xs font-medium">
              MI
            </div>
          </div>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {NAV.map(({ to, label, exact }) => {
            const active = exact ? path === to : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors duration-300",
                  active ? "bg-white/10 text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}