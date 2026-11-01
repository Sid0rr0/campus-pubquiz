/** What every API client throws for a reply that is not ok: the message to show and the HTTP status. Each client extends it, so a caller can tell which API failed with `instanceof`. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The JSON body of a failed reply; empty when the body is not JSON (a proxy's error page during a redeploy). */
export async function readErrorBody<T extends { message?: string }>(
  response: Response,
): Promise<Partial<T>> {
  return (await response.json().catch(() => ({}))) as Partial<T>;
}

/** The message a failed reply carries, or `fallback` when it has none. */
export async function errorMessageOf(
  response: Response,
  fallback: string,
): Promise<string> {
  return (await readErrorBody(response)).message ?? fallback;
}
