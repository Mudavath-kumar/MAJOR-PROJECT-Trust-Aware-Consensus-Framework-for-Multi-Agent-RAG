import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithRetry } from "../src/lib/retry";

test("fetchWithRetry retries a transient network failure and returns the response", async () => {
  let attempts = 0;
  const response = new Response(JSON.stringify({ ok: true }), { status: 200 });

  const result = await fetchWithRetry(
    "https://example.test/health",
    {},
    {
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError("network unavailable");
        return response;
      },
      delayMs: 0,
    },
  );

  assert.equal(result, response);
  assert.equal(attempts, 2);
});

test("fetchWithRetry does not retry authentication failures", async () => {
  let attempts = 0;

  const result = await fetchWithRetry(
    "https://example.test/api",
    {},
    {
      fetchImpl: async () => {
        attempts += 1;
        return new Response("unauthorized", { status: 401 });
      },
      delayMs: 0,
    },
  );

  assert.equal(result.status, 401);
  assert.equal(attempts, 1);
});

test("fetchWithRetry does not retry rate-limited requests", async () => {
  let attempts = 0;

  const result = await fetchWithRetry(
    "https://example.test/api",
    {},
    {
      fetchImpl: async () => {
        attempts += 1;
        return new Response("rate limited", { status: 429, headers: { "Retry-After": "900" } });
      },
      delayMs: 0,
    },
  );

  assert.equal(result.status, 429);
  assert.equal(attempts, 1);
});

test("fetchWithRetry aborts a request that exceeds its deadline", async () => {
  await assert.rejects(
    fetchWithRetry(
      "https://example.test/api",
      {},
      {
        timeoutMs: 5,
        fetchImpl: async (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
              once: true,
            });
          }),
      },
    ),
    /timed out/i,
  );
});
