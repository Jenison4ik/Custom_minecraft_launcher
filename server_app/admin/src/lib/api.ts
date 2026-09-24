import { useAuth } from "@/store/auth";

const API = "/minecraft/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = useAuth.getState().token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 401 && !path.startsWith("/auth/")) {
    useAuth.getState().logout();
    const login = `${import.meta.env.BASE_URL}login`;
    if (!window.location.pathname.endsWith("/login")) {
      window.location.assign(login);
    }
  }

  if (!response.ok) {
    let message = "Ошибка запроса";
    try {
      const body = (await response.json()) as { error?: string };
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* empty body */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
