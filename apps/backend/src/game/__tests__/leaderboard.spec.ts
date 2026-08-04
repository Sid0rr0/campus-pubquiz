import { IllegalGameTransitionError } from '@campus-pubquiz/types';
import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  asSeedService,
  asGameProgressRepository,
} from './test-utils';

describe('GameStateService — leaderboard', () => {
  let service: GameStateService;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
  });

  it('toggles the leaderboard without disturbing the underlying status', async () => {
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    const withLeaderboard = await service.applyAction('TOGGLE_LEADERBOARD');
    expect(withLeaderboard.progress.status).toBe('question_open');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.currentQuestion?.id).toBe(21);
  });

  it('reveals teams one at a time via REVEAL_NEXT_TEAM, bottom-up and bounded by team count', async () => {
    service.setLeaderboard([
      { teamId: 1, teamName: 'First', totalPoints: 10 },
      { teamId: 2, teamName: 'Second', totalPoints: 5 },
    ]);
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('ADVANCE'); // -> r1q1
    await service.applyAction('TOGGLE_LEADERBOARD');
    expect(service.getSnapshot().leaderboardRevealCount).toBe(0);

    await service.applyAction('REVEAL_NEXT_TEAM');
    expect(service.getSnapshot().leaderboardRevealCount).toBe(1);

    await service.applyAction('REVEAL_NEXT_TEAM');
    expect(service.getSnapshot().leaderboardRevealCount).toBe(2);

    // Bounded: a further reveal doesn't exceed the number of teams.
    await expect(
      service.applyAction('REVEAL_NEXT_TEAM'),
    ).resolves.toMatchObject({
      leaderboardRevealCount: 2,
    });
  });

  it('rejects REVEAL_NEXT_TEAM while the leaderboard is hidden', async () => {
    await expect(service.applyAction('REVEAL_NEXT_TEAM')).rejects.toThrow(
      IllegalGameTransitionError,
    );
  });

  it('also advances the leaderboard reveal on ADVANCE while the board is visible', async () => {
    service.setLeaderboard([
      { teamId: 1, teamName: 'First', totalPoints: 10 },
      { teamId: 2, teamName: 'Second', totalPoints: 5 },
    ]);
    await service.applyAction('START_QUIZ');
    await service.applyAction('ADVANCE'); // -> round_intro(0)
    await service.applyAction('TOGGLE_LEADERBOARD');

    const afterAdvance = await service.applyAction('ADVANCE'); // -> r1q1, board still visible
    expect(afterAdvance.leaderboardRevealCount).toBe(1);
  });

  it('resets the reveal count whenever the leaderboard is toggled', async () => {
    service.setLeaderboard([{ teamId: 1, teamName: 'First', totalPoints: 10 }]);
    await service.applyAction('START_QUIZ');
    await service.applyAction('TOGGLE_LEADERBOARD');
    await service.applyAction('REVEAL_NEXT_TEAM');
    expect(service.getSnapshot().leaderboardRevealCount).toBe(1);

    await service.applyAction('TOGGLE_LEADERBOARD'); // hide
    expect(service.getSnapshot().leaderboardRevealCount).toBe(0);

    await service.applyAction('TOGGLE_LEADERBOARD'); // show again, fresh
    expect(service.getSnapshot().leaderboardRevealCount).toBe(0);
  });

  it('starts with an empty leaderboard', () => {
    expect(service.getSnapshot().leaderboard).toEqual([]);
  });

  it('reflects a leaderboard set via setLeaderboard in the snapshot', () => {
    service.setLeaderboard([
      { teamId: 31, teamName: 'The Quizzards', totalPoints: 5 },
    ]);

    expect(service.getSnapshot().leaderboard).toEqual([
      { teamId: 31, teamName: 'The Quizzards', totalPoints: 5 },
    ]);
  });
});
