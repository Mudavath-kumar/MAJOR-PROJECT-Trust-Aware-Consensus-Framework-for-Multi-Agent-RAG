import { createFileRoute, Link, Outlet, useNavigate, useRouterState, Navigate } from "@tanstack/react-router";
import {
  Bell,
  BarChart3,
  Bot,
  Check,
  ClipboardList,
  Database,
  ExternalLink,
  Hexagon,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Shield,
  Upload,
  User,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, useClerk, useUser, useAuth } from "@clerk/clerk-react";
import { ApiClient } from "@/lib/api-client";


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
  to: "/app" | "/app/chat" | "/app/upload" | "/app/knowledge" | "/app/analytics" | "/app/evaluations" | "/app/settings";
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
  { to: "/app/evaluations", label: "Evaluations", icon: ClipboardList },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useClerk();
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Sync Clerk user & auth token with the backend ApiClient
  useEffect(() => {
    if (user) {
      const email = user.primaryEmailAddress?.emailAddress || "";
      const name = user.fullName || user.firstName || "User";
      ApiClient.setUserEmail(email);
      ApiClient.setUserName(name);
      void getToken().then((token) => {
        if (token) ApiClient.setToken(token);
      });
    }
  }, [user, getToken]);

  // Close popovers on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signOut({ redirectUrl: "/login" });
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Hexagon size={28} className="animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" />;
  }

  // User display info
  const displayName = user?.fullName || user?.firstName || "User";
  const displayEmail = user?.primaryEmailAddress?.emailAddress || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <SignedIn>
        <div className="relative flex min-h-screen flex-col bg-background">
          <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-2xl">
            <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
              <Link to="/" className="flex shrink-0 items-center gap-2 group">
                <Hexagon
                  size={22}
                  strokeWidth={1.5}
                  className="text-accent transition-transform duration-300 group-hover:rotate-12"
                />
                <span className="text-lg font-semibold tracking-tight">TrustRAG</span>
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
                  aria-label="Search workspace"
                  placeholder="Search documents, chunks, answers…"
                  className="h-9 w-full rounded-full border border-border bg-muted/70 pl-9 pr-4 text-sm outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-muted-foreground focus:border-foreground/30 focus:bg-background focus:ring-2 focus:ring-ring/20"
                />
              </div>

              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                {/* Notification Menu */}
                <div className="relative" ref={notifRef}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="relative rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Bell size={18} />
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                  </Button>

                  {notifOpen && (
                    <div className="absolute right-0 top-11 w-80 rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur-2xl animate-rise z-50">
                      <div className="flex items-center justify-between pb-3 border-b border-border">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                          Telemetry Alerts
                        </span>
                        <span className="text-[10px] rounded-full bg-accent/15 px-2 py-0.5 text-accent font-semibold">
                          2 New
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5">
                          <p className="font-medium text-foreground">Consensus Engine Normal</p>
                          <p className="mt-0.5 text-muted-foreground text-[11px]">
                            3 agents agreed with 96.8% agreement score.
                          </p>
                          <span className="mt-1 block font-mono text-[9px] text-muted-foreground">
                            2m ago
                          </span>
                        </div>
                        <div className="rounded-xl border border-border/80 bg-muted/30 p-2.5">
                          <p className="font-medium text-foreground">Ingestion Pipeline Idle</p>
                          <p className="mt-0.5 text-muted-foreground text-[11px]">
                            All uploaded chunks embedded and verified.
                          </p>
                          <span className="mt-1 block font-mono text-[9px] text-muted-foreground">
                            14m ago
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* User Profile Avatar with dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    aria-label="User profile menu"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold text-foreground hover:border-accent/50 hover:bg-accent/10 transition-all focus:outline-none"
                  >
                    {user?.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt={displayName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      initials || <User size={14} />
                    )}
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-11 w-64 rounded-2xl border border-border bg-card p-3 shadow-2xl backdrop-blur-2xl animate-rise z-50">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-sm font-semibold text-foreground">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                          <Shield size={10} /> Enterprise Workspace
                        </div>
                      </div>

                      <div className="mt-2 space-y-1 text-xs">
                        <Link
                          to="/app/settings"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Settings size={14} /> Pipeline Settings
                        </Link>
                        <Link
                          to="/"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <ExternalLink size={14} /> Marketing Home
                        </Link>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <LogOut size={14} /> Log out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <nav className="mx-auto w-full max-w-[1400px] px-4 pb-3 sm:px-6 lg:px-8">
              <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-secondary/40 p-1 shadow-sm backdrop-blur-md">
                {NAV.map(({ to, label, icon: Icon, exact }) => {
                  const active = exact ? path === to : path.startsWith(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-[color,background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <Icon size={15} className="shrink-0" />
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
      </SignedIn>
      <SignedOut>
        <Navigate to="/login" />
      </SignedOut>
    </>
  );
}
