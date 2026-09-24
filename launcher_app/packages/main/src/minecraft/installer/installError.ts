import { sendPhase } from "../../services/notifyService";

interface ErrorLike {
  message?: string;
  name?: string;
  code?: string;
  url?: string;
  errors?: unknown[];
}

function asErrorLike(error: unknown): ErrorLike {
  if (typeof error === "object" && error !== null) return error as ErrorLike;
  return { message: String(error) };
}

export function flattenErrors(error: unknown): ErrorLike[] {
  const current = asErrorLike(error);
  if (Array.isArray(current.errors) && current.errors.length > 0) {
    return current.errors.flatMap((item) => flattenErrors(item));
  }
  return [current];
}

export function logInstallError(error: unknown): void {
  const flat = flattenErrors(error);
  const sample = flat.slice(0, 3).map((item) => {
    const code = item.code || item.name || "error";
    return item.url ? `${code} ${item.url}` : `${code} ${item.message ?? ""}`.trim();
  });
  console.warn(`Install error (${flat.length}): ${sample.join("; ")}`);
}

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function summarizeInstallError(error: unknown): string {
  const flat = flattenErrors(error);
  const first = flat[0];
  const count = Math.max(flat.length, 1);
  const host = hostOf(first?.url);
  const where = host ? ` с ${host}` : "";
  const code = first?.code ?? "";
  const timeout =
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_SOCKET";

  if (timeout) {
    return `Не удалось скачать ${count} файлов${where} (таймаут соединения). Проверьте интернет и нажмите «Восстановить игровые файлы».`;
  }
  if (first?.name === "ChecksumNotMatchError") {
    return `Не удалось скачать ${count} файлов${where}: контрольная сумма не совпала. Нажмите «Восстановить игровые файлы».`;
  }
  const message = first?.message?.trim();
  if (message && message !== "AggregateError") return message;
  return `Не удалось скачать файлы игры${where}. Проверьте интернет и нажмите «Восстановить игровые файлы».`;
}

/** Retries a step up to 4 times. Pauses 2s, 4s, then 8s between attempts. */
export async function withRetry<T>(
  step: () => Promise<T>,
  attempts = 4
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await step();
    } catch (error) {
      lastError = error;
      logInstallError(error);
      if (attempt >= attempts) break;
      const waitSec = 2 ** attempt;
      sendPhase(`Повтор ${attempt}/${attempts} через ${waitSec} с`);
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
    }
  }
  throw lastError;
}
