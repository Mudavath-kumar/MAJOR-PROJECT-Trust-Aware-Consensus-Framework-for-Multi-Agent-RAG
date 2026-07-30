import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-32px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MonoLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-rise">
        <MonoLabel>{eyebrow}</MonoLabel>
        <h1 className="mt-2 text-3xl font-normal tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ScorePill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300 border-emerald-400/25 bg-emerald-400/10"
      : tone === "warn"
        ? "text-amber-300 border-amber-400/25 bg-amber-400/10"
        : "text-foreground border-border bg-white/5";
  return (
    <div className={cn("rounded-lg border px-3 py-2", toneClass)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-70">{label}</div>
      <div className="mt-1 text-lg font-medium tabular-nums">{value}%</div>
    </div>
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}