import { afterEach, describe, expect, it, vi } from 'vitest';

/** One API client function: the exact request it sends and the error it throws on a non-ok reply. */
export interface ApiCase {
  name: string;
  call: () => Promise<unknown>;
  url: string;
  /** Omit for a bare `fetch(url)` call. */
  init?: RequestInit;
  /** The message thrown when the reply carries none. */
  fallback: string;
  okBody?: unknown;
  okText?: string;
  /** What the call resolves to; defaults to `okBody`. Pass `undefined` for a void call. */
  expected?: unknown;
}

interface ContractOptions {
  /** The client survives a reply whose body is not JSON (falls back to the default message). */
  toleratesBadJson: boolean;
}

const originalFetch = global.fetch;

function stub(reply: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(reply);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export function describeApiClient(
  label: string,
  ErrorClass: new (...args: never[]) => Error & { status: number },
  errorName: string,
  cases: ApiCase[],
  options: ContractOptions,
): void {
  describe(`${label} contract`, () => {
    afterEach(() => {
      global.fetch = originalFetch;
    });

    describe.each(cases)('$name', (c) => {
      it('sends the exact request and returns the reply', async () => {
        const fetchMock = stub({
          ok: true,
          status: 200,
          json: () => Promise.resolve(c.okBody ?? {}),
          text: () => Promise.resolve(c.okText ?? ''),
        });

        const result = await c.call();

        expect(result).toEqual('expected' in c ? c.expected : c.okBody);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const args = c.init === undefined ? [c.url] : [c.url, c.init];
        expect(fetchMock).toHaveBeenCalledWith(...args);
      });

      it('throws the typed error with the fallback message and the status', async () => {
        stub({ ok: false, status: 418, json: () => Promise.resolve({}) });

        const error = await c.call().catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ErrorClass);
        expect((error as Error).name).toBe(errorName);
        expect((error as Error).message).toBe(c.fallback);
        expect((error as { status: number }).status).toBe(418);
      });

      it('prefers the message the server sent', async () => {
        stub({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'Server says no' }),
        });

        const error = await c.call().catch((e: unknown) => e);

        expect((error as Error).message).toBe('Server says no');
        expect((error as { status: number }).status).toBe(403);
      });

      if (options.toleratesBadJson) {
        it('falls back to the default message when the body is not JSON', async () => {
          stub({
            ok: false,
            status: 502,
            json: () => Promise.reject(new SyntaxError('Unexpected token <')),
          });

          const error = await c.call().catch((e: unknown) => e);

          expect(error).toBeInstanceOf(ErrorClass);
          expect((error as Error).message).toBe(c.fallback);
          expect((error as { status: number }).status).toBe(502);
        });
      }
    });
  });
}

export const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
export const JSON_TYPE = { 'Content-Type': 'application/json' };
