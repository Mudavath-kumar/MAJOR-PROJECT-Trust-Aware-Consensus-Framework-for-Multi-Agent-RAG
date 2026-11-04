export type FetchRetryOptions = {
  attempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isRetryableStatus(status: number) {
  // Rate-limited responses carry a server-directed wait (often many minutes).
  // Retrying immediately only adds load and consumes more of the same quota.
  return status === 408 || status === 425 || status >= 500;
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
  const timeoutMs = Math.max(0, options.timeoutMs ?? 0);
  const fetchImpl = options.fetchImpl ?? fetch;
  const method = String(init.method ?? "GET").toUpperCase();
  const canRetry = RETRYABLE_METHODS.has(method);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const callerSignal = init.signal;
    const forwardAbort = () => controller?.abort(callerSignal?.reason);
    if (controller && callerSignal) {
      if (callerSignal.aborted) forwardAbort();
      else callerSignal.addEventListener("abort", forwardAbort, { once: true });
    }
    const timeout = controller
      ? setTimeout(
          () =>
            controller.abort(
              new DOMException(`Request timed out after ${timeoutMs} ms`, "TimeoutError"),
            ),
          timeoutMs,
        )
      : undefined;

    try {
      const response = await fetchImpl(
        input,
        controller ? { ...init, signal: controller.signal } : init,
      );
      if (!canRetry || !isRetryableStatus(response.status) || attempt === attempts - 1) {
        return response;
      }
    } catch (error) {
      if (
        controller?.signal.reason instanceof DOMException &&
        controller.signal.reason.name === "TimeoutError"
      ) {
        throw new Error(`Request timed out after ${timeoutMs} ms`);
      }
      lastError = error;
      if (!canRetry || attempt === attempts - 1) throw error;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", forwardAbort);
    }

    await wait(delayMs * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed after retries");
}
