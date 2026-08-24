import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import {
  GameStateService,
  SessionSettingsUpdateBlockedError,
} from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
} from './test-utils';

describe('GameStateService — updateSessionSettings', () => {
  let service: GameStateService;
  let seedService: ReturnType<typeof createFakeSeedService>;
  let joinCode: string;

  beforeEach(async () => {
    seedService = createFakeSeedService();
    service = new GameStateService(
      asSeedService(seedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('exposes the default settings before any update', () => {
    expect(service.getSessionSettings(joinCode)).toEqual(
      DEFAULT_SESSION_SETTINGS,
    );
  });

  it('merges a partial over the current settings while in the lobby', async () => {
    await service.updateSessionSettings(joinCode, { lockGraceSeconds: 15 });

    expect(service.getSessionSettings(joinCode)).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
    });
  });

  it('persists the merged settings via SeedService.updateSettings', async () => {
    await service.updateSessionSettings(joinCode, { autoplayMedia: false });

    expect(seedService.updateSettings).toHaveBeenCalledWith(101, {
      ...DEFAULT_SESSION_SETTINGS,
      autoplayMedia: false,
    });
  });

  it('leaves fields not present in the partial untouched across successive updates', async () => {
    await service.updateSessionSettings(joinCode, { lockGraceSeconds: 15 });
    await service.updateSessionSettings(joinCode, { autoplayMedia: false });

    expect(service.getSessionSettings(joinCode)).toEqual({
      ...DEFAULT_SESSION_SETTINGS,
      lockGraceSeconds: 15,
      autoplayMedia: false,
    });
  });

  it('rejects updating settings once the quiz has started', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');

    await expect(
      service.updateSessionSettings(joinCode, { lockGraceSeconds: 15 }),
    ).rejects.toThrow(SessionSettingsUpdateBlockedError);
    expect(service.getSessionSettings(joinCode)).toEqual(
      DEFAULT_SESSION_SETTINGS,
    );
  });

  it('reflects the updated settings in getSnapshot', async () => {
    await service.updateSessionSettings(joinCode, {
      rules: ['Just one rule.'],
    });

    expect(service.getSnapshot(joinCode).settings.rules).toEqual([
      'Just one rule.',
    ]);
  });
});
