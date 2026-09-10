import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createImportPreview, type ImportPreview } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { ImportController } from '@/import/import.controller';
import {
  ImportBlockedError,
  ImportLockedError,
  type ImportService,
} from '@/import/import.service';
import { SheetFetchError } from '@/import/sheet-url-fetcher';

const CSV = 'round,type,question,options,answer,points,media_url,notes\n';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';

function makeController() {
  const importService = {
    preview: jest.fn(),
    confirm: jest.fn(),
    previewFromUrl: jest.fn(),
    confirmFromUrl: jest.fn(),
  };
  const controller = new ImportController(
    importService as unknown as ImportService,
  );
  return { controller, importService };
}

function blockedPreview(): ImportPreview {
  return createImportPreview(
    'Imported Quiz',
    [],
    [{ rowNumber: 2, field: 'answer', message: 'Missing answer' }],
  );
}

describe('ImportController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', ImportController) as
      | unknown[]
      | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  describe('preview', () => {
    it('returns the service preview for a valid body', () => {
      const { controller, importService } = makeController();
      const preview = createImportPreview('Trivia Night', [], []);
      importService.preview.mockReturnValue(preview);

      const response = controller.preview({
        csvText: CSV,
        quizTitle: 'Trivia Night',
      });

      expect(response).toBe(preview);
      expect(importService.preview).toHaveBeenCalledWith(CSV, 'Trivia Night');
    });

    it('rejects a body without csvText', () => {
      const { controller } = makeController();

      expect(() => controller.preview({} as { csvText: string })).toThrow(
        BadRequestException,
      );
    });

    it('rejects an empty csvText', () => {
      const { controller } = makeController();

      expect(() => controller.preview({ csvText: '' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirm', () => {
    it('returns the confirm result for a valid body', async () => {
      const { controller, importService } = makeController();
      const result = { quizId: 'quiz-1', roundCount: 1, questionCount: 2 };
      importService.confirm.mockResolvedValue(result);

      await expect(
        controller.confirm({
          csvText: CSV,
          quizTitle: 'Trivia Night',
          joinCode: 'ABCDEF',
        }),
      ).resolves.toBe(result);
      expect(importService.confirm).toHaveBeenCalledWith(
        CSV,
        'ABCDEF',
        'Trivia Night',
      );
    });

    it('rejects a body without joinCode', async () => {
      const { controller } = makeController();

      await expect(controller.confirm({ csvText: CSV })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('maps a blocked import to 422 with the issues attached', async () => {
      const { controller, importService } = makeController();
      const preview = blockedPreview();
      importService.confirm.mockRejectedValue(new ImportBlockedError(preview));

      const promise = controller.confirm({ csvText: CSV, joinCode: 'ABCDEF' });

      await expect(promise).rejects.toThrow(UnprocessableEntityException);
      await promise.catch((error: UnprocessableEntityException) => {
        expect(error.getResponse()).toMatchObject({ issues: preview.issues });
      });
    });

    it('maps a locked import to 409 conflict', async () => {
      const { controller, importService } = makeController();
      importService.confirm.mockRejectedValue(
        new ImportLockedError('question_open'),
      );

      await expect(
        controller.confirm({ csvText: CSV, joinCode: 'ABCDEF' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lets unexpected errors bubble up unchanged', async () => {
      const { controller, importService } = makeController();
      importService.confirm.mockRejectedValue(new Error('db down'));

      await expect(
        controller.confirm({ csvText: CSV, joinCode: 'ABCDEF' }),
      ).rejects.toThrow('db down');
    });
  });

  describe('previewFromUrl', () => {
    it('returns the service preview for a valid body', async () => {
      const { controller, importService } = makeController();
      const preview = createImportPreview('Trivia Night', [], []);
      importService.previewFromUrl.mockResolvedValue(preview);

      const response = controller.previewFromUrl({
        sheetUrl: SHEET_URL,
        quizTitle: 'Trivia Night',
      });

      await expect(response).resolves.toBe(preview);
      expect(importService.previewFromUrl).toHaveBeenCalledWith(
        SHEET_URL,
        'Trivia Night',
      );
    });

    it('rejects a body without sheetUrl', () => {
      const { controller } = makeController();

      expect(() =>
        controller.previewFromUrl({} as { sheetUrl: string }),
      ).toThrow(BadRequestException);
    });

    it('rejects an empty sheetUrl', () => {
      const { controller } = makeController();

      expect(() => controller.previewFromUrl({ sheetUrl: '' })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirmFromUrl', () => {
    it('returns the confirm result for a valid body', async () => {
      const { controller, importService } = makeController();
      const result = { quizId: 1, roundCount: 1, questionCount: 2 };
      importService.confirmFromUrl.mockResolvedValue(result);

      await expect(
        controller.confirmFromUrl({
          sheetUrl: SHEET_URL,
          quizTitle: 'Trivia Night',
          joinCode: 'ABCDEF',
        }),
      ).resolves.toBe(result);
      expect(importService.confirmFromUrl).toHaveBeenCalledWith(
        SHEET_URL,
        'ABCDEF',
        'Trivia Night',
      );
    });

    it('rejects a body without joinCode', async () => {
      const { controller } = makeController();

      await expect(
        controller.confirmFromUrl({ sheetUrl: SHEET_URL }),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps a sheet fetch failure to 422 with just the message', async () => {
      const { controller, importService } = makeController();
      importService.confirmFromUrl.mockRejectedValue(
        new SheetFetchError('Could not fetch that sheet'),
      );

      const promise = controller.confirmFromUrl({
        sheetUrl: SHEET_URL,
        joinCode: 'ABCDEF',
      });

      await expect(promise).rejects.toThrow(UnprocessableEntityException);
      await promise.catch((error: UnprocessableEntityException) => {
        expect(error.getResponse()).toEqual({
          message: 'Could not fetch that sheet',
        });
      });
    });

    it('maps a blocked import to 422 with the issues attached', async () => {
      const { controller, importService } = makeController();
      const preview = blockedPreview();
      importService.confirmFromUrl.mockRejectedValue(
        new ImportBlockedError(preview),
      );

      const promise = controller.confirmFromUrl({
        sheetUrl: SHEET_URL,
        joinCode: 'ABCDEF',
      });

      await expect(promise).rejects.toThrow(UnprocessableEntityException);
      await promise.catch((error: UnprocessableEntityException) => {
        expect(error.getResponse()).toMatchObject({ issues: preview.issues });
      });
    });

    it('maps a locked import to 409 conflict', async () => {
      const { controller, importService } = makeController();
      importService.confirmFromUrl.mockRejectedValue(
        new ImportLockedError('question_open'),
      );

      await expect(
        controller.confirmFromUrl({ sheetUrl: SHEET_URL, joinCode: 'ABCDEF' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lets unexpected errors bubble up unchanged', async () => {
      const { controller, importService } = makeController();
      importService.confirmFromUrl.mockRejectedValue(new Error('db down'));

      await expect(
        controller.confirmFromUrl({ sheetUrl: SHEET_URL, joinCode: 'ABCDEF' }),
      ).rejects.toThrow('db down');
    });
  });
});
