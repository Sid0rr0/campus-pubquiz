export class SheetFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetFetchError';
  }
}

const SHEET_HOST = 'docs.google.com';
const SHEET_PATH_PATTERN = /^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
const GID_PATTERN = /^\d+$/;

// Google's export endpoint always 307-redirects to a per-request URL on its
// own CDN (docs.google.com/.../export → *.googleusercontent.com/export/...),
// even for a fully public sheet — this happens before any auth/sharing check
// runs, so it is not itself a sign of a sharing problem. That redirect target
// is generated entirely by Google's own service from the validated
// spreadsheet id, never from anything the requester supplies, so following
// it — and only it — doesn't reopen the SSRF surface that `parseGoogleSheetUrl`
// closes off; a redirect to any other host (e.g. an accounts.google.com
// sign-in page for a non-public sheet) is rejected instead of followed.
const TRUSTED_REDIRECT_HOST_SUFFIX = '.googleusercontent.com';

const SHEET_FETCH_TIMEOUT_MS = 10_000;
export const MAX_SHEET_RESPONSE_BYTES = 5 * 1024 * 1024;

const NOT_SHARED_MESSAGE =
  'Could not fetch that sheet — make sure it\'s shared as "Anyone with the ' +
  'link can view", or try again if the network dropped.';
const TIMEOUT_MESSAGE =
  'Fetching that sheet took too long — check your connection and try again.';

export interface ParsedGoogleSheetUrl {
  spreadsheetId: string;
  gid?: string;
}

function extractGid(url: URL): string | undefined {
  const candidate =
    url.searchParams.get('gid') ?? /gid=(\d+)/.exec(url.hash)?.[1];
  return candidate && GID_PATTERN.test(candidate) ? candidate : undefined;
}

/**
 * Validates a pasted Google Sheets URL and extracts only the spreadsheet id
 * (+ optional gid) — the caller must never fetch the raw input string, only
 * a URL it constructs itself from these two values, to keep the fetch
 * target's host fixed at docs.google.com regardless of what was pasted.
 */
export function parseGoogleSheetUrl(input: string): ParsedGoogleSheetUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SheetFetchError('That does not look like a valid URL.');
  }

  if (url.protocol !== 'https:' || url.hostname !== SHEET_HOST) {
    throw new SheetFetchError(
      `The URL must be a ${SHEET_HOST} link (e.g. https://${SHEET_HOST}/spreadsheets/d/.../edit).`,
    );
  }

  const match = SHEET_PATH_PATTERN.exec(url.pathname);
  if (!match) {
    throw new SheetFetchError(
      'Could not find a spreadsheet id in that URL — expected a link like ' +
        `https://${SHEET_HOST}/spreadsheets/d/{id}/edit.`,
    );
  }

  return { spreadsheetId: match[1], gid: extractGid(url) };
}

function buildExportUrl(spreadsheetId: string, gid?: string): string {
  const url = new URL(
    `https://${SHEET_HOST}/spreadsheets/d/${spreadsheetId}/export`,
  );
  url.searchParams.set('format', 'csv');
  if (gid) url.searchParams.set('gid', gid);
  return url.toString();
}

async function readBodyWithLimit(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    // A GET response with a non-empty body always has a stream in every
    // runtime this app targets; refuse rather than fall back to
    // response.text(), which would silently skip the size cap below.
    throw new SheetFetchError('Could not read the sheet response.');
  }

  const decoder = new TextDecoder();
  let text = '';
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_SHEET_RESPONSE_BYTES) {
      await reader.cancel();
      throw new SheetFetchError('That sheet is too large to import.');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

function isTrustedRedirectHost(hostname: string): boolean {
  return (
    hostname === 'googleusercontent.com' ||
    hostname.endsWith(TRUSTED_REDIRECT_HOST_SUFFIX)
  );
}

async function fetchWithTimeout(url: string): Promise<Response> {
  try {
    return await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(SHEET_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new SheetFetchError(TIMEOUT_MESSAGE);
    }
    throw new SheetFetchError(NOT_SHARED_MESSAGE);
  }
}

/**
 * Validates and follows a single redirect hop from `response`, only when its
 * target is Google's own export CDN — anything else (a sign-in page, or any
 * other host) is treated as a fetch failure rather than followed.
 */
async function followTrustedRedirect(
  response: Response,
  requestUrl: string,
): Promise<Response> {
  const location = response.headers.get('location');
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(location ?? '', requestUrl);
  } catch {
    throw new SheetFetchError(NOT_SHARED_MESSAGE);
  }

  if (
    redirectUrl.protocol !== 'https:' ||
    !isTrustedRedirectHost(redirectUrl.hostname)
  ) {
    throw new SheetFetchError(NOT_SHARED_MESSAGE);
  }

  return fetchWithTimeout(redirectUrl.toString());
}

/**
 * Fetches a Google Sheet's CSV export. The fetch URL is always built from
 * an already-validated `spreadsheetId`/`gid` pair (see `parseGoogleSheetUrl`)
 * — never from a raw user-supplied URL. Google's export endpoint always
 * redirects once to its own CDN (see `followTrustedRedirect`); any other
 * redirect target, or a second redirect from the CDN itself, fails instead
 * of being followed.
 */
export async function fetchSheetCsv(
  spreadsheetId: string,
  gid?: string,
): Promise<string> {
  const exportUrl = buildExportUrl(spreadsheetId, gid);
  let response = await fetchWithTimeout(exportUrl);

  if (response.status >= 300 && response.status < 400) {
    response = await followTrustedRedirect(response, exportUrl);
  }

  if (!response.ok) {
    throw new SheetFetchError(NOT_SHARED_MESSAGE);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new SheetFetchError(NOT_SHARED_MESSAGE);
  }

  return readBodyWithLimit(response);
}
