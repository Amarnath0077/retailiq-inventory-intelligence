/**
 * API client utility for RetailIQ
 * Injects Authorization Bearer tokens and handles credentials cleanly.
 */

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('retailiq_token');
  } catch {
    return null;
  }
}

export function getAuthHeaders(extraHeaders?: HeadersInit): Headers {
  const headers = new Headers(extraHeaders || {});
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = getAuthHeaders(init?.headers);
  return window.fetch(input, {
    ...init,
    headers,
  });
}
