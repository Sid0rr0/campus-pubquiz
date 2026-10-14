// A spec must never reach the network: whether it passes would then depend on
// what happens to listen on the backend address (e.g. a dev backend on :3000).
// Specs that need `fetch` stub it (vi.stubGlobal / vi.spyOn); anything else
// lands here. The call rejects with the method and URL, and is also recorded
// so the spec fails even if app code catches and swallows the rejection.

const unmockedRequests: string[] = [];

function describeRequest(input: RequestInfo | URL, init?: RequestInit): string {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
  let url: string;
  if (typeof input === 'string') url = input;
  else if (input instanceof URL) url = input.href;
  else url = input.url;
  return `${method} ${url}`;
}

export function installUnmockedFetchGuard(): void {
  globalThis.fetch = (input, init) => {
    const description = describeRequest(input, init);
    unmockedRequests.push(description);
    return Promise.reject(
      new Error(`Unmocked network request: ${description}`),
    );
  };
}

/** Returns the unmocked requests seen since the last call, and clears them. */
export function takeUnmockedRequests(): string[] {
  return unmockedRequests.splice(0);
}
