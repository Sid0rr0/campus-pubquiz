import { ImportService } from '@/import/import.service';
import { fetchSheetCsv, SheetFetchError } from '@/import/sheet-url-fetcher';

jest.mock('@/import/sheet-url-fetcher', () => ({
  ...jest.requireActual<typeof import('@/import/sheet-url-fetcher')>(
    '@/import/sheet-url-fetcher',
  ),
  fetchSheetCsv: jest.fn(),
}));

const mockedFetchSheetCsv = fetchSheetCsv as jest.MockedFunction<
  typeof fetchSheetCsv
>;

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';

const HEADER =
  'round,type,question,options,answer,points,media_url,answer_media_url,notes,break_after';

const VALID_CSV = [
  HEADER,
  'History,free_text,Largest planet?,,Jupiter,2,,,,0',
  'History,multiple_choice,Capital of France?,Paris|London,Paris,3,,,,0',
  'Music,free_text,Name this song.,,Bohemian Rhapsody,2,https://example.com/song.mp3,https://example.com/song-answer.jpg,,1',
].join('\n');

describe('ImportService', () => {
  beforeEach(() => {
    mockedFetchSheetCsv.mockReset();
  });

  function makeService() {
    return { importService: new ImportService() };
  }

  describe('preview', () => {
    it('parses and validates the csv without writing anything', () => {
      // Arrange
      const { importService } = makeService();

      // Act
      const preview = importService.preview(VALID_CSV, 'Trivia Night');

      // Assert
      expect(preview.isImportable).toBe(true);
      expect(preview.quizTitle).toBe('Trivia Night');
      expect(preview.rounds.map((round) => round.title)).toEqual([
        'History',
        'Music',
      ]);
    });

    it('reports a file-level problem as an issue instead of throwing', () => {
      const { importService } = makeService();

      const preview = importService.preview('not,a,quiz\nsheet,at,all');

      expect(preview.isImportable).toBe(false);
      expect(preview.issues).toHaveLength(1);
      expect(preview.issues[0]).toMatchObject({ rowNumber: 1, field: 'file' });
    });

    it('defaults the quiz title when none is provided', () => {
      const { importService } = makeService();

      const preview = importService.preview(VALID_CSV);

      expect(preview.quizTitle).toBe('Imported Quiz');
    });
  });

  describe('previewFromUrl', () => {
    it('fetches the sheet and validates it like preview()', async () => {
      // Arrange
      const { importService } = makeService();
      mockedFetchSheetCsv.mockResolvedValue({ csvText: VALID_CSV });

      // Act
      const preview = await importService.previewFromUrl(
        SHEET_URL,
        'Trivia Night',
      );

      // Assert
      expect(preview.isImportable).toBe(true);
      expect(preview.rounds.map((round) => round.title)).toEqual([
        'History',
        'Music',
      ]);
      expect(mockedFetchSheetCsv).toHaveBeenCalledWith('abc123', undefined);
    });

    it('names the quiz after the sheet when no title was given', async () => {
      const { importService } = makeService();
      mockedFetchSheetCsv.mockResolvedValue({
        csvText: VALID_CSV,
        sheetName: 'Trivia Night',
      });

      const preview = await importService.previewFromUrl(SHEET_URL);

      expect(preview.quizTitle).toBe('Trivia Night');
    });

    it('prefers an explicitly given title over the sheet name', async () => {
      const { importService } = makeService();
      mockedFetchSheetCsv.mockResolvedValue({
        csvText: VALID_CSV,
        sheetName: 'Trivia Night',
      });

      const preview = await importService.previewFromUrl(
        SHEET_URL,
        'Custom Title',
      );

      expect(preview.quizTitle).toBe('Custom Title');
    });

    it('reports a fetch failure as an issue instead of throwing', async () => {
      const { importService } = makeService();
      mockedFetchSheetCsv.mockRejectedValue(
        new SheetFetchError('Could not fetch that sheet'),
      );

      const preview = await importService.previewFromUrl(SHEET_URL);

      expect(preview.isImportable).toBe(false);
      expect(preview.issues).toEqual([
        {
          rowNumber: 1,
          field: 'sheetUrl',
          message: 'Could not fetch that sheet',
        },
      ]);
    });

    it('rejects a URL that is not a docs.google.com spreadsheet link before fetching', async () => {
      const { importService } = makeService();

      const preview = await importService.previewFromUrl(
        'https://evil.com/spreadsheets/d/abc123',
      );

      expect(preview.isImportable).toBe(false);
      expect(preview.issues[0].field).toBe('sheetUrl');
      expect(mockedFetchSheetCsv).not.toHaveBeenCalled();
    });
  });
});
