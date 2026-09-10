import {
  MAX_SHEET_RESPONSE_BYTES,
  SheetFetchError,
  fetchSheetCsv,
  parseGoogleSheetUrl,
} from '@/import/sheet-url-fetcher';

describe('parseGoogleSheetUrl', () => {
  it('extracts the spreadsheet id and gid from an edit link with a hash gid', () => {
    // Arrange
    const url = 'https://docs.google.com/spreadsheets/d/abc123/edit#gid=456';

    // Act
    const parsed = parseGoogleSheetUrl(url);

    // Assert
    expect(parsed).toEqual({ spreadsheetId: 'abc123', gid: '456' });
  });

  it('extracts the spreadsheet id and gid from an edit link with a query gid', () => {
    const url = 'https://docs.google.com/spreadsheets/d/abc123/edit?gid=456';

    const parsed = parseGoogleSheetUrl(url);

    expect(parsed).toEqual({ spreadsheetId: 'abc123', gid: '456' });
  });

  it('extracts the spreadsheet id from a bare /d/{id} link with no gid', () => {
    const url = 'https://docs.google.com/spreadsheets/d/abc123';

    const parsed = parseGoogleSheetUrl(url);

    expect(parsed).toEqual({ spreadsheetId: 'abc123', gid: undefined });
  });

  it('throws on a non-URL string', () => {
    expect(() => parseGoogleSheetUrl('not a url')).toThrow(SheetFetchError);
  });

  it('rejects a host that is not docs.google.com', () => {
    expect(() =>
      parseGoogleSheetUrl('https://evil.com/spreadsheets/d/abc123/edit'),
    ).toThrow(SheetFetchError);
  });

  it('rejects a lookalike subdomain of docs.google.com', () => {
    expect(() =>
      parseGoogleSheetUrl(
        'https://docs.google.com.evil.com/spreadsheets/d/abc123/edit',
      ),
    ).toThrow(SheetFetchError);
  });

  it('rejects a userinfo trick whose hostname is actually attacker-controlled', () => {
    expect(() =>
      parseGoogleSheetUrl(
        'https://docs.google.com@evil.com/spreadsheets/d/abc123/edit',
      ),
    ).toThrow(SheetFetchError);
  });

  it('rejects the http scheme', () => {
    expect(() =>
      parseGoogleSheetUrl('http://docs.google.com/spreadsheets/d/abc123/edit'),
    ).toThrow(SheetFetchError);
  });

  it('rejects a docs.google.com URL with no spreadsheet id in the path', () => {
    expect(() =>
      parseGoogleSheetUrl('https://docs.google.com/document/d/abc123/edit'),
    ).toThrow(SheetFetchError);
  });
});

const CDN_URL =
  'https://doc-14-2s-sheets.googleusercontent.com/export/abc/def?format=csv';

function redirectResponse(location: string): Response {
  return new Response(null, { status: 307, headers: { location } });
}

describe('fetchSheetCsv redirect handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('follows the single redirect Google always issues to its own export CDN', async () => {
    // Arrange — Google's export endpoint 307s to *.googleusercontent.com
    // even for a fully public sheet, before any sharing check runs.
    const csvText = 'round,type,question,answer\nHistory,free_text,Q,A\n';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirectResponse(CDN_URL))
      .mockResolvedValueOnce(
        new Response(csvText, {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      );
    global.fetch = fetchMock;

    // Act
    const result = await fetchSheetCsv('abc123');

    // Assert
    expect(result).toBe(csvText);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://docs.google.com/spreadsheets/d/abc123/export?format=csv',
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      CDN_URL,
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('includes the gid in the constructed export URL when provided', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirectResponse(CDN_URL))
      .mockResolvedValueOnce(
        new Response('a,b\n1,2\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        }),
      );
    global.fetch = fetchMock;

    await fetchSheetCsv('abc123', '456');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=456',
      expect.anything(),
    );
  });

  it('rejects a redirect to a host other than googleusercontent.com (e.g. a sign-in page for a non-public sheet)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        redirectResponse('https://accounts.google.com/ServiceLogin'),
      );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
  });

  it('rejects a lookalike redirect host that merely contains googleusercontent.com', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        redirectResponse('https://googleusercontent.com.evil.com/export'),
      );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
  });

  it('rejects a second redirect from the CDN itself rather than following it', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(redirectResponse(CDN_URL))
      .mockResolvedValueOnce(
        redirectResponse('https://other.googleusercontent.com/elsewhere'),
      );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
  });
});

describe('fetchSheetCsv', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws a timeout-specific message when the fetch times out, distinct from a sharing failure', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new DOMException('The operation was aborted.', 'TimeoutError'),
      );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(/took too long/i);
  });

  it('throws on a non-OK response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('', { status: 404 }));

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
  });

  it('throws when the response looks like an HTML login page instead of CSV', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('<html><body>Sign in</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
  });

  it('throws when the response body exceeds the size limit', async () => {
    const oversized = 'x'.repeat(MAX_SHEET_RESPONSE_BYTES + 1024);
    global.fetch = jest.fn().mockResolvedValue(
      new Response(oversized, {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      }),
    );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
  });
});
