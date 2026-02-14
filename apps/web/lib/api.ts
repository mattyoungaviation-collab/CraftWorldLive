import { getSessionToken } from "./auth";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:10000";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }

  const sessionToken = getSessionToken();
  if (sessionToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers
  });
}
