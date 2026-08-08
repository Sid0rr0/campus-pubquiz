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
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('toggles the leaderboard without disturbing the underlying status', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    const withLeaderboard = await service.applyAction(
      joinCode,
      'TOGGLE_LEADERBOARD',
    );
    expect(withLeaderboard.progress.status).toBe('question_open');
    expect(withLeaderboard.progress.isLeaderboardVisible).toBe(true);
    expect(withLeaderboard.currentQuestion?.id).toBe(21);
  });

  it('reveals teams one at a time via REVEAL_NEXT_TEAM, bottom-up and bounded by team count', async () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 1,
        teamName: 'First',
        totalPoints: 10,
        bonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Second',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'TOGGLE_LEADERBOARD');
    expect(service.getSnapshot(joinCode).leaderboardRevealCount).toBe(0);

    await service.applyAction(joinCode, 'REVEAL_NEXT_TEAM');
    expect(service.getSnapshot(joinCode).leaderboardRevealCount).toBe(1);

    await service.applyAction(joinCode, 'REVEAL_NEXT_TEAM');
    expect(service.getSnapshot(joinCode).leaderboardRevealCount).toBe(2);

    // Bounded: a further reveal doesn't exceed the number of teams.
    await expect(
      service.applyAction(joinCode, 'REVEAL_NEXT_TEAM'),
    ).resolves.toMatchObject({
      leaderboardRevealCount: 2,
    });
  });

  it('rejects REVEAL_NEXT_TEAM while the leaderboard is hidden', async () => {
    await expect(
      service.applyAction(joinCode, 'REVEAL_NEXT_TEAM'),
    ).rejects.toThrow(IllegalGameTransitionError);
  });

  it('also advances the leaderboard reveal on ADVANCE while the board is visible', async () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 1,
        teamName: 'First',
        totalPoints: 10,
        bonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Second',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'TOGGLE_LEADERBOARD');

    const afterAdvance = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1, board still visible
    expect(afterAdvance.leaderboardRevealCount).toBe(1);
  });

  it('resets the reveal count whenever the leaderboard is toggled', async () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 1,
        teamName: 'First',
        totalPoints: 10,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'TOGGLE_LEADERBOARD');
    await service.applyAction(joinCode, 'REVEAL_NEXT_TEAM');
    expect(service.getSnapshot(joinCode).leaderboardRevealCount).toBe(1);

    await service.applyAction(joinCode, 'TOGGLE_LEADERBOARD'); // hide
    expect(service.getSnapshot(joinCode).leaderboardRevealCount).toBe(0);

    await service.applyAction(joinCode, 'TOGGLE_LEADERBOARD'); // show again, fresh
    expect(service.getSnapshot(joinCode).leaderboardRevealCount).toBe(0);
  });

  it('shows the leaderboard screen immediately when the quiz ends, teams still revealed one at a time', async () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 1,
        teamName: 'First',
        totalPoints: 10,
        bonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Second',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
    await service.applyAction(joinCode, 'START_QUIZ');

    const ended = await service.applyAction(joinCode, 'END_QUIZ');

    expect(ended.progress.isLeaderboardVisible).toBe(true);
    expect(ended.leaderboardRevealCount).toBe(0);

    const afterFirstReveal = await service.applyAction(
      joinCode,
      'REVEAL_NEXT_TEAM',
    );
    expect(afterFirstReveal.leaderboardRevealCount).toBe(1);
  });

  it('shows the leaderboard screen when advancing past the last reveal question ends the quiz naturally', async () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 1,
        teamName: 'First',
        totalPoints: 10,
        bonusPoints: 0,
        roundPoints: [],
      },
      {
        teamId: 2,
        teamName: 'Second',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
    await service.applyAction(joinCode, 'START_QUIZ');

    let snapshot = service.getSnapshot(joinCode);
    // Walk ADVANCE all the way through both rounds' questions, the break,
    // and every reveal step — same as an admin just clicking through to the
    // end without ever pressing the separate "End Quiz" button.
    for (let i = 0; i < 20 && snapshot.progress.status !== 'ended'; i += 1) {
      snapshot = await service.applyAction(joinCode, 'ADVANCE');
    }

    expect(snapshot.progress.status).toBe('ended');
    expect(snapshot.progress.isLeaderboardVisible).toBe(true);
    // The very ADVANCE that crosses into 'ended' also counts as this
    // leaderboard's first reveal step, same as any other ADVANCE while the
    // board is visible.
    expect(snapshot.leaderboardRevealCount).toBe(1);
  });

  it('starts with an empty leaderboard', () => {
    expect(service.getSnapshot(joinCode).leaderboard).toEqual([]);
  });

  it('reflects a leaderboard set via setLeaderboard in the snapshot', () => {
    service.setLeaderboard(joinCode, [
      {
        teamId: 31,
        teamName: 'The Quizzards',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);

    expect(service.getSnapshot(joinCode).leaderboard).toEqual([
      {
        teamId: 31,
        teamName: 'The Quizzards',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
  });
});
