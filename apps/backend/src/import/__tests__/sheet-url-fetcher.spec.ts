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

  it('rejects a spreadsheet path that has a prefix before /spreadsheets/d/', () => {
    expect(() =>
      parseGoogleSheetUrl(
        'https://docs.google.com/evil/spreadsheets/d/abc123/edit',
      ),
    ).toThrow(SheetFetchError);
  });

  it.each([
    'https://docs.google.com/spreadsheets/d/abc123/edit?gid=x12',
    'https://docs.google.com/spreadsheets/d/abc123/edit?gid=12x',
    'https://docs.google.com/spreadsheets/d/abc123/edit?gid=',
    'https://docs.google.com/spreadsheets/d/abc123/edit#gid=x12',
  ])('drops a gid that is not all digits (%s)', (url) => {
    expect(parseGoogleSheetUrl(url)).toEqual({
      spreadsheetId: 'abc123',
      gid: undefined,
    });
  });

  it('explains each refusal in words the moderator can act on', () => {
    expect(() => parseGoogleSheetUrl('not a url')).toThrow(
      'That does not look like a valid URL.',
    );
    expect(() => parseGoogleSheetUrl('https://evil.com/x')).toThrow(
      'The URL must be a docs.google.com link (e.g. https://docs.google.com/spreadsheets/d/.../edit).',
    );
    expect(() =>
      parseGoogleSheetUrl('https://docs.google.com/document/d/abc/edit'),
    ).toThrow(
      'Could not find a spreadsheet id in that URL — expected a link like https://docs.google.com/spreadsheets/d/{id}/edit.',
    );
  });
});

const CDN_URL =
  'https://doc-14-2s-sheets.googleusercontent.com/export/abc/def?format=csv';

function redirectResponse(location: string): Response {
  return new Response(null, { status: 307, headers: { location } });
}

function csvResponse(
  body: BodyInit | null,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/csv', ...extraHeaders },
  });
}

const NOT_SHARED_MESSAGE =
  'Could not fetch that sheet — make sure it\'s shared as "Anyone with the ' +
  'link can view", or try again if the network dropped.';
const TIMEOUT_MESSAGE =
  'Fetching that sheet took too long — check your connection and try again.';

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
    expect(result.csvText).toBe(csvText);
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

  // Each rejection test queues a good CSV after the bad redirect, so a fetch
  // that wrongly followed the redirect would succeed instead of failing later.
  it.each([
    [
      'a sign-in page for a non-public sheet',
      'https://accounts.google.com/ServiceLogin',
    ],
    [
      'a lookalike host that merely contains googleusercontent.com',
      'https://googleusercontent.com.evil.com/export',
    ],
    [
      'a host that only ends in googleusercontent.com without a dot',
      'https://evilgoogleusercontent.com/export',
    ],
    [
      'a CDN host over plain http',
      'http://doc-14-2s-sheets.googleusercontent.com/export',
    ],
    ['an unparseable location', 'https://'],
  ])(
    'refuses a redirect to %s without following it',
    async (_label, location) => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(redirectResponse(location))
        .mockResolvedValueOnce(csvResponse('a,b\n1,2\n'));
      global.fetch = fetchMock;

      const error: unknown = await fetchSheetCsv('abc123').catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(SheetFetchError);
      expect((error as SheetFetchError).message).toBe(NOT_SHARED_MESSAGE);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('refuses a redirect that carries no location header', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 307 }))
      .mockResolvedValueOnce(csvResponse('a,b\n1,2\n'));
    global.fetch = fetchMock;

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(NOT_SHARED_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('trusts a redirect to the bare googleusercontent.com host', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        redirectResponse('https://googleusercontent.com/export'),
      )
      .mockResolvedValueOnce(csvResponse('a,b\n1,2\n'));

    const result = await fetchSheetCsv('abc123');

    expect(result.csvText).toBe('a,b\n1,2\n');
  });

  it.each([300, 399])(
    'follows a %i redirect to the export CDN',
    async (status) => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status, headers: { location: CDN_URL } }),
        )
        .mockResolvedValueOnce(csvResponse('a,b\n1,2\n'));

      const result = await fetchSheetCsv('abc123');

      expect(result.csvText).toBe('a,b\n1,2\n');
    },
  );

  it.each([400, 404])(
    'does not follow a %i response even when it carries a CDN location',
    async (status) => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status, headers: { location: CDN_URL } }),
        )
        .mockResolvedValueOnce(csvResponse('a,b\n1,2\n'));
      global.fetch = fetchMock;

      await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a second redirect from the CDN itself rather than following it', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirectResponse(CDN_URL))
      .mockResolvedValueOnce(
        redirectResponse('https://other.googleusercontent.com/elsewhere'),
      )
      .mockResolvedValueOnce(csvResponse('a,b\n1,2\n'));
    global.fetch = fetchMock;

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(SheetFetchError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(TIMEOUT_MESSAGE);
  });

  it.each([
    ['a network failure', new TypeError('fetch failed')],
    ['an abort that is not a timeout', new DOMException('x', 'AbortError')],
    [
      'a plain error that only borrows the timeout name',
      Object.assign(new Error('x'), { name: 'TimeoutError' }),
    ],
  ])(
    'reports %s as a sharing failure, not a timeout',
    async (_label, error) => {
      global.fetch = jest.fn().mockRejectedValue(error);

      const caught: unknown = await fetchSheetCsv('abc123').catch(
        (e: unknown) => e,
      );

      expect((caught as SheetFetchError).message).toBe(NOT_SHARED_MESSAGE);
    },
  );

  it('reports a non-OK response with the sharing message', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response('', { status: 403 }));

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(NOT_SHARED_MESSAGE);
  });

  it('reports an HTML login page with the sharing message', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(NOT_SHARED_MESSAGE);
  });

  it('refuses a response with no readable body', async () => {
    global.fetch = jest.fn().mockResolvedValue(csvResponse(null));

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(
      'Could not read the sheet response.',
    );
  });

  it('accepts a body of exactly the size limit', async () => {
    const exact = 'x'.repeat(MAX_SHEET_RESPONSE_BYTES);
    global.fetch = jest.fn().mockResolvedValue(csvResponse(exact));

    const result = await fetchSheetCsv('abc123');

    expect(result.csvText).toHaveLength(MAX_SHEET_RESPONSE_BYTES);
  });

  it('says the sheet is too large when the body exceeds the limit', async () => {
    const oversized = 'x'.repeat(MAX_SHEET_RESPONSE_BYTES + 1);
    global.fetch = jest.fn().mockResolvedValue(csvResponse(oversized));

    await expect(fetchSheetCsv('abc123')).rejects.toThrow(
      'That sheet is too large to import.',
    );
  });

  it('decodes a multi-byte character split across two chunks', async () => {
    // '€' is the three bytes e2 82 ac; the chunk boundary falls inside it.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0x61, 0xe2, 0x82]));
        controller.enqueue(new Uint8Array([0xac, 0x62]));
        controller.close();
      },
    });
    global.fetch = jest.fn().mockResolvedValue(csvResponse(stream));

    const result = await fetchSheetCsv('abc123');

    expect(result.csvText).toBe('a€b');
  });

  it('reads an unquoted ASCII filename', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      csvResponse('a,b\n', {
        'content-disposition': 'attachment; filename=Trivia Night.csv',
      }),
    );

    const result = await fetchSheetCsv('abc123');

    expect(result.sheetName).toBe('Trivia Night');
  });

  it('trims the name, with or without a tab segment', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        csvResponse('a,b\n', {
          'content-disposition': 'attachment; filename="Trivia Night .csv"',
        }),
      )
      .mockResolvedValueOnce(
        csvResponse('a,b\n', {
          'content-disposition':
            'attachment; filename="Trivia Night  - Tab.csv"',
        }),
      );

    expect((await fetchSheetCsv('abc123')).sheetName).toBe('Trivia Night');
    expect((await fetchSheetCsv('abc123')).sheetName).toBe('Trivia Night');
  });

  it('drops only a trailing .csv extension', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      csvResponse('a,b\n', {
        'content-disposition': 'attachment; filename="Notes.csv backup.csv"',
      }),
    );

    const result = await fetchSheetCsv('abc123');

    expect(result.sheetName).toBe('Notes.csv backup');
  });

  it('leaves the name undefined when the filename is only an extension', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      csvResponse('a,b\n', {
        'content-disposition': 'attachment; filename=".csv"',
      }),
    );

    const result = await fetchSheetCsv('abc123');

    expect(result.sheetName).toBeUndefined();
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

  it("extracts just the spreadsheet's own name, dropping the sheet/tab name, from the export response's UTF-8 filename", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('a,b\n1,2\n', {
        status: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition':
            'attachment; filename="TriviaNight-Round1.csv"; ' +
            "filename*=UTF-8''Trivia%20Night%20-%20Round%201.csv",
        },
      }),
    );

    const result = await fetchSheetCsv('abc123');

    expect(result.sheetName).toBe('Trivia Night');
  });

  it('falls back to the ASCII filename when no UTF-8 filename is present', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('a,b\n1,2\n', {
        status: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename="Trivia Night.csv"',
        },
      }),
    );

    const result = await fetchSheetCsv('abc123');

    expect(result.sheetName).toBe('Trivia Night');
  });

  it('leaves the sheet name undefined when the response has no content-disposition header', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response('a,b\n1,2\n', {
        status: 200,
        headers: { 'content-type': 'text/csv' },
      }),
    );

    const result = await fetchSheetCsv('abc123');

    expect(result.sheetName).toBeUndefined();
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
