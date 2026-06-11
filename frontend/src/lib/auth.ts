const TOKEN_KEY = "wc_pool_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const AUTH_LOGOUT_EVENT = "vitobet:logout";

/** Drop VitoBet JWT and tell Google not to auto-pick the last account. */
export function clearAuthSession(): void {
  setToken(null);
  if (typeof window === "undefined") return;
  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    /* GIS not loaded */
  }
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}

export class ApiAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}
