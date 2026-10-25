export function meanObservedScore(values: Array<number | null | undefined>): number | null {
  const observed = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (observed.length === 0) return null;
  return Math.round(observed.reduce((sum, value) => sum + value, 0) / observed.length);
}
