type ApiErrorConstructor<T extends Error> = new (...args: never[]) => T;

/**
 * Unwraps a typed API error into the message the UI shows, mapping anything
 * else (network failures, thrown non-Errors) onto the call site's fallback.
 * Returns null for "no error", so callers can feed it straight into an
 * `error && <p role="alert">` render.
 */
export function apiErrorMessage(
  error: unknown,
  ErrorClass: ApiErrorConstructor<Error>,
  fallback: string,
): string | null {
  if (error === null || error === undefined) return null;
  return error instanceof ErrorClass ? error.message : fallback;
}
