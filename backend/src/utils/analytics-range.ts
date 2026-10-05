export type AnalyticsRange = "7d" | "30d" | "all";

export function resolveAnalyticsRange(value: unknown): AnalyticsRange {
  return value === "30d" || value === "all" || value === "7d" ? value : "7d";
}

export function getAnalyticsRangeStart(range: AnalyticsRange, now = new Date()): Date | null {
  if (range === "all") return null;

  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (range === "30d" ? 29 : 6));
  return start;
}
