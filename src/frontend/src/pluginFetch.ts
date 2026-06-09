const CSRF_COOKIE_PREFIX = 'csrf-token=';

function getCSRFToken(): string | undefined {
  if (typeof document === 'undefined' || !document.cookie) {
    return undefined;
  }

  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(CSRF_COOKIE_PREFIX))
    .map((cookie) => cookie.slice(CSRF_COOKIE_PREFIX.length))
    .pop();
}

/**
 * Fetch wrapper for OpenShift console plugin proxy requests.
 * Adds X-CSRFToken for non-GET requests, matching consoleFetch behavior.
 */
export function pluginFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);

  if (method !== 'GET' && method !== 'HEAD') {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers.set('X-CSRFToken', csrfToken);
    }
  }

  return fetch(url, { ...options, headers });
}
