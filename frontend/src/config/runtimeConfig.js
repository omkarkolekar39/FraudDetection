const fallbackApiBaseUrl = 'http://127.0.0.1:8000/api';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || fallbackApiBaseUrl,
);

export const API_ORIGIN = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL;

export const PUBLIC_AUTH_ROUTES = ['/login', '/register'];
