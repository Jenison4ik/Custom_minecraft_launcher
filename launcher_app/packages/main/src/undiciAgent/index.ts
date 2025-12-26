import { Agent } from "undici";

/* ──────────────────────────────
   CONSTANTS
────────────────────────────── */

const DEFAULT_CONNECTIONS = 1;
const DEFAULT_PIPELINING = 1;
const DEFAULT_CONNECT_TIMEOUT = 60_000;
const DEFAULT_HEADERS_TIMEOUT = 300_000;
const DEFAULT_BODY_TIMEOUT = 300_000;

/* ──────────────────────────────
   INTERFACE
────────────────────────────── */

export interface UndiciAgentOptions {
  connections?: number;
  pipelining?: number;
  connectTimeout?: number;
  headersTimeout?: number;
  bodyTimeout?: number;
}

/* ──────────────────────────────
   SINGLETON STATE
────────────────────────────── */

let singletonAgent: Agent | null = null;

/* ──────────────────────────────
   INTERNAL FACTORY
────────────────────────────── */

function createAgent(options: UndiciAgentOptions): Agent {
  return new Agent({
    connections: options.connections ?? DEFAULT_CONNECTIONS,
    pipelining: options.pipelining ?? DEFAULT_PIPELINING,
    headersTimeout: options.headersTimeout ?? DEFAULT_HEADERS_TIMEOUT,
    bodyTimeout: options.bodyTimeout ?? DEFAULT_BODY_TIMEOUT,
  });
}

/* ──────────────────────────────
   PUBLIC API
────────────────────────────── */

/**
 * Возвращает singleton undici Agent
 * ❗ НИЧЕГО глобально не устанавливает
 */
export function getUndiciAgent(options: UndiciAgentOptions = {}): Agent {
  if (!singletonAgent) {
    singletonAgent = createAgent(options);
  }

  return singletonAgent;
}
