import { Agent, interceptors, request, type Dispatcher } from "undici";

const RETRY_ERROR_CODES = [
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ETIMEDOUT",
  "EAI_AGAIN",
];

let dispatcher: Dispatcher | null = null;

function createDispatcher(): Dispatcher {
  return new Agent({
    connections: 16,
    pipelining: 1,
    connect: { timeout: 30_000 },
    headersTimeout: 60_000,
    bodyTimeout: 120_000,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 60_000,
  }).compose(
    interceptors.retry({
      maxRetries: 4,
      minTimeout: 1_000,
      maxTimeout: 15_000,
      timeoutFactor: 2,
      errorCodes: RETRY_ERROR_CODES,
    }),
    interceptors.redirect({ maxRedirections: 5 })
  );
}

/** Shared undici dispatcher for xmcl downloads and manifest requests. */
export function getDownloadDispatcher(): Dispatcher {
  if (!dispatcher) dispatcher = createDispatcher();
  return dispatcher;
}

/** @deprecated Use getDownloadDispatcher. Kept so existing call sites keep compiling. */
export function getUndiciAgent(): Dispatcher {
  return getDownloadDispatcher();
}

/** @deprecated Use getDownloadDispatcher. Does not replace Node's global fetch. */
export function setupUndiciAgent(): Dispatcher {
  return getDownloadDispatcher();
}

export function setupDefaultUndiciAgent(): Dispatcher {
  return getDownloadDispatcher();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch-compatible request with a timeout and a few retries.
 * Used for version manifests, where xmcl calls `response.json()`.
 */
export const fetchWithRetry: typeof fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const timeoutMs = 30_000;
  const retries = 3;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await request(url, {
        method: init?.method ?? "GET",
        dispatcher: getDownloadDispatcher(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = Buffer.from(await response.body.arrayBuffer());
      if (response.statusCode >= 500 && attempt < retries) {
        await delay(1_000 * 2 ** attempt);
        continue;
      }
      return new Response(body, {
        status: response.statusCode,
        headers: Object.entries(response.headers).flatMap(([key, value]) => {
          if (value == null) return [];
          const values = Array.isArray(value) ? value : [String(value)];
          return values.map((item) => [key, item] as [string, string]);
        }),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await delay(1_000 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};
