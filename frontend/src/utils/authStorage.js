const AUTH_STORAGE_KEYS = {
  token: 'access_token',
  role: 'user_role',
  username: 'username',
};

export function readAuthSession() {
  const token = localStorage.getItem(AUTH_STORAGE_KEYS.token);
  const role = localStorage.getItem(AUTH_STORAGE_KEYS.role);
  const username = localStorage.getItem(AUTH_STORAGE_KEYS.username);

  if (!token || !role || !username) {
    return null;
  }

  return { token, role, username };
}

export function persistAuthSession(session) {
  if (!session?.token || !session?.role || !session?.username) {
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEYS.token, session.token);
  localStorage.setItem(AUTH_STORAGE_KEYS.role, session.role);
  localStorage.setItem(AUTH_STORAGE_KEYS.username, session.username);
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.token);
  localStorage.removeItem(AUTH_STORAGE_KEYS.role);
  localStorage.removeItem(AUTH_STORAGE_KEYS.username);
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_STORAGE_KEYS.token);
}

export { AUTH_STORAGE_KEYS };
