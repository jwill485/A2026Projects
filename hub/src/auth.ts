const TOKEN_KEY = "hub:session-token";

// Any one backend can issue/verify a token -- all three check it against the
// same shared SESSION_SECRET, so it doesn't matter which one answers this.
// RosterManager's is used as the login/session authority by convention.
const AUTH_BACKEND_URL = import.meta.env.VITE_ROSTER_BACKEND_URL || "http://localhost:8000";

export interface SessionStatus {
  authRequired: boolean;
  valid: boolean;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function checkSession(): Promise<SessionStatus> {
  const token = getToken();
  try {
    const res = await fetch(`${AUTH_BACKEND_URL}/api/session`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { authRequired: true, valid: false };
    return await res.json();
  } catch {
    // Backend unreachable -- treat as "can't confirm," not "locked out."
    // The actual app views will surface the real connection error once
    // they try to load data.
    return { authRequired: false, valid: true };
  }
}

export async function login(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`${AUTH_BACKEND_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return { ok: false, error: detail?.detail ?? `Login failed (${res.status})` };
  }
  const { token } = await res.json();
  setToken(token);
  return { ok: true };
}

// Fires whenever a request comes back 401'd with a token attached, so the
// app shell can drop back to the login screen instead of showing a stuck
// "Failed to load" error.
export const SESSION_EXPIRED_EVENT = "hub:session-expired";

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && token) {
    clearToken();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return res;
}
