export type FetchRetryOptions = {
  attempts?: number;
  delayMs?: number;
  fetchImpl?: typeof fetch;
};

const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function wait(delayMs: number) {
  return delayMs > 0
    ? new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    : Promise.resolve();
}

/** Retry only idempotent requests and transient upstream failures. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
) {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const delayMs = Math.max(0, options.delayMs ?? 250);
  const fetchImpl = options.fetchImpl ?? fetch;
  const method = String(init.method ?? "GET").toUpperCase();
  const canRetry = RETRYABLE_METHODS.has(method);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(input, init);
      if (!canRetry || !isRetryableStatus(response.status) || attempt === attempts - 1) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (!canRetry || attempt === attempts - 1) throw error;
    }

    await wait(delayMs * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed after retries");
}
