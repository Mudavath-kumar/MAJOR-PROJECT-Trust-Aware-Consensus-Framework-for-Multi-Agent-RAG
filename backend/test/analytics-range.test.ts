import assert from "node:assert/strict";
import test from "node:test";
import { getAnalyticsRangeStart, resolveAnalyticsRange } from "../src/utils/analytics-range.js";

test("resolveAnalyticsRange accepts only the supported analytics ranges", () => {
  assert.equal(resolveAnalyticsRange("7d"), "7d");
  assert.equal(resolveAnalyticsRange("30d"), "30d");
  assert.equal(resolveAnalyticsRange("all"), "all");
  assert.equal(resolveAnalyticsRange("invalid"), "7d");
  assert.equal(resolveAnalyticsRange(undefined), "7d");
});

test("getAnalyticsRangeStart uses the start of the local day", () => {
  const now = new Date("2026-10-05T14:30:00.000Z");

  assert.equal(getAnalyticsRangeStart("7d", now)?.toISOString(), "2026-09-29T00:00:00.000Z");
  assert.equal(getAnalyticsRangeStart("30d", now)?.toISOString(), "2026-09-06T00:00:00.000Z");
  assert.equal(getAnalyticsRangeStart("all", now), null);
});
