import { BadRequestException } from '@nestjs/common';
import { createImportPreview } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { ImportController } from '@/import/import.controller';
import type { ImportService } from '@/import/import.service';

const CSV = 'round,type,question,options,answer,points,media_url,notes\n';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';

function makeController() {
  const importService = {
    preview: jest.fn(),
    previewFromUrl: jest.fn(),
  };
  const controller = new ImportController(
    importService as unknown as ImportService,
  );
  return { controller, importService };
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
      expect(importService.preview).toHaveBeenCalledWith(
        CSV,
        'Trivia Night',
        'pub',
      );
    });

    it('passes a quickfire mode through and rejects an unknown one', () => {
      const { controller, importService } = makeController();

      controller.preview({ csvText: CSV, mode: 'quickfire' });

      expect(importService.preview).toHaveBeenCalledWith(
        CSV,
        undefined,
        'quickfire',
      );
      expect(() =>
        controller.preview({ csvText: CSV, mode: 'kahoot' as 'pub' }),
      ).toThrow(BadRequestException);
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
        'pub',
      );
    });

    it('rejects an unknown mode', () => {
      const { controller } = makeController();

      expect(() =>
        controller.previewFromUrl({
          sheetUrl: SHEET_URL,
          mode: 'x' as 'pub',
        }),
      ).toThrow(BadRequestException);
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
});
