/**
 * Sent on every state-changing (non-GET) request to a cookie-authenticated
 * backend endpoint. The backend's SessionGuard rejects such requests
 * without it — a plain cross-site HTML form can't set a custom header, so
 * this blocks form-based CSRF even though the session cookie is
 * SameSite=None in production. See apps/backend/src/auth/session.guard.ts.
 */
export const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' } as const;
