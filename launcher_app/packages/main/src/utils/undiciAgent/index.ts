import { Agent, setGlobalDispatcher } from "undici";

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

let globalAgent: Agent | null = null;
let isDispatcherSet = false;

/* ──────────────────────────────
   INTERNAL FACTORY
────────────────────────────── */

function createAgent(options: UndiciAgentOptions): Agent {
  return new Agent({
    connections: options.connections ?? DEFAULT_CONNECTIONS,
    pipelining: options.pipelining ?? DEFAULT_PIPELINING,
    headersTimeout: options.headersTimeout ?? DEFAULT_HEADERS_TIMEOUT,
    bodyTimeout: options.bodyTimeout ?? DEFAULT_BODY_TIMEOUT,
    keepAliveTimeout: options.headersTimeout ?? DEFAULT_CONNECT_TIMEOUT, // таймаут неактивного сокета
    keepAliveMaxTimeout: 600_000,
  });
}

/* ──────────────────────────────
   PUBLIC API
────────────────────────────── */

/**
 * Возвращает singleton Agent
 * Создаётся только один раз за всё время жизни процесса
 */
export function getUndiciAgent(options: UndiciAgentOptions = {}): Agent {
  if (!globalAgent) {
    globalAgent = createAgent(options);
  }

  return globalAgent;
}

/**
 * Устанавливает глобальный dispatcher (один раз)
 * Повторные вызовы безопасны
 */
export function setupUndiciAgent(options: UndiciAgentOptions = {}): Agent {
  const agent = getUndiciAgent(options);

  if (!isDispatcherSet) {
    setGlobalDispatcher(agent);
    isDispatcherSet = true;
  }

  return agent;
}

/**
 * Быстрая настройка с дефолтами
 */
export function setupDefaultUndiciAgent(): Agent {
  return setupUndiciAgent();
}
