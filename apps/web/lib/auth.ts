export const SESSION_TOKEN_KEY = "cw.sessionToken";
export const ID_TOKEN_KEY = "cw.idToken";

export function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SESSION_TOKEN_KEY) || "";
}

export function getIdToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ID_TOKEN_KEY) || "";
}

export function saveAuthTokens(sessionToken: string, idToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  localStorage.setItem(ID_TOKEN_KEY, idToken);
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(ID_TOKEN_KEY);
}
