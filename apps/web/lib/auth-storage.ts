export type StoredUser = {
  id: string;
  email: string;
  createdAt: string;
};

type AuthSession = {
  token: string;
  user: StoredUser;
};

const AUTH_STORAGE_KEY = "vidai-auth";
const AUTH_COOKIE_KEY = "vidai-token";

function setTokenCookie(token: string) {
  document.cookie = `${AUTH_COOKIE_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

function clearTokenCookie() {
  document.cookie = `${AUTH_COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
}

export function saveAuthSession(session: AuthSession) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  setTokenCookie(session.token);
}

export function getAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getAuthToken() {
  return getAuthSession()?.token ?? null;
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  clearTokenCookie();
}
