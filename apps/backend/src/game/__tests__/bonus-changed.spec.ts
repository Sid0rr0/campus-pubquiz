import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type LeaderboardEntry,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import {
  BonusAwardNotFoundError,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { UnknownLiveSessionError } from '@/game/rest/live-session-rest.service';

describe('GameGateway — bonus changed and leaderboard toggle', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let scorer: { socket: MockSocket; teamId: number };
  let idle: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards', 'Idle Team'],
    });
    admin = await game.connectAdmin();
    [scorer, idle] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function lastLeaderboard(): LeaderboardEntry[] {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
    return snapshots[snapshots.length - 1].leaderboard;
  }

  function bonusOf(teamId: number): number | undefined {
    return lastLeaderboard().find((entry) => entry.teamId === teamId)
      ?.bonusPoints;
  }

  async function awardShot(points: number): Promise<number> {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: scorer.teamId,
      category: 'shot',
      points,
    });
    const [award] = await game.inRequestContext(() =>
      game.bonusService.listForTeamAdmin(game.gameSessionId, scorer.teamId),
    );
    game.clearEmits();
    return award.id;
  }

  it('shows a socket bonus award in the next snapshot and notifies the awarded team', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: scorer.teamId,
      category: 'shot',
      points: 1,
    });

    expect(bonusOf(scorer.teamId)).toBe(1);
    expect(game.roomEmits()).toContainEqual(
      expect.objectContaining({
        rooms: [scorer.socket.id],
        event: SOCKET_EVENTS.BONUS_AWARDED,
        payload: { category: 'shot', points: 1, reason: undefined },
      }),
    );
  });

  it('shows a REST bonus edit in the next snapshot', async () => {
    const awardId = await awardShot(1);

    const updated = await game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, awardId, 3, undefined),
    );

    expect(updated).toEqual(
      expect.objectContaining({ id: awardId, points: 3 }),
    );
    expect(bonusOf(scorer.teamId)).toBe(3);
  });

  it('shows a REST bonus deletion in the next snapshot', async () => {
    const awardId = await awardShot(1);

    await game.inRequestContext(() =>
      game.rest.removeBonus(game.joinCode, awardId),
    );

    expect(bonusOf(scorer.teamId)).toBe(0);
  });

  it('applies a REST bonus edit queued behind a held write after that write, and the next snapshot reflects both', async () => {
    const awardId = await awardShot(1);
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: idle.teamId,
      category: 'shot',
      points: 2,
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const editing = game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, awardId, 3, undefined),
    );
    await waiting;
    const storedWhileHeld = await game.inRequestContext(() =>
      game.bonusService.listForTeamAdmin(game.gameSessionId, scorer.teamId),
    );
    held.release();
    await awarding;
    await editing;

    expect(storedWhileHeld).toEqual([
      expect.objectContaining({ id: awardId, points: 1 }),
    ]);
    expect(bonusOf(scorer.teamId)).toBe(3);
    expect(bonusOf(idle.teamId)).toBe(2);
  });

  it.each([
    ['zero points', 0, 'Bonus points must be a non-zero number'],
    ['a custom award with no reason', 2, 'A custom bonus needs a reason'],
  ])(
    'refuses a REST bonus edit with %s, storing and emitting nothing',
    async (_label, points, message) => {
      await game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: scorer.teamId,
        category: 'custom',
        points: 1,
        reason: 'Best costume',
      });
      const [award] = await game.inRequestContext(() =>
        game.bonusService.listForTeamAdmin(game.gameSessionId, scorer.teamId),
      );
      game.clearEmits();

      await expect(
        game.inRequestContext(() =>
          game.rest.editBonus(
            game.joinCode,
            award.id,
            points,
            points === 0 ? 'Best costume' : undefined,
          ),
        ),
      ).rejects.toThrow(new InvalidBonusAwardError(message));

      const stored = await game.inRequestContext(() =>
        game.bonusService.listForTeamAdmin(game.gameSessionId, scorer.teamId),
      );
      expect(stored).toEqual([
        expect.objectContaining({ points: 1, reason: 'Best costume' }),
      ]);
      expect(game.roomEmits()).toEqual([]);
    },
  );

  it('refuses a REST bonus edit or deletion of an award not in this session as not found, emitting nothing', async () => {
    await expect(
      game.inRequestContext(() =>
        game.rest.editBonus(game.joinCode, 987654, 3, undefined),
      ),
    ).rejects.toBeInstanceOf(BonusAwardNotFoundError);
    await expect(
      game.inRequestContext(() => game.rest.removeBonus(game.joinCode, 987654)),
    ).rejects.toBeInstanceOf(BonusAwardNotFoundError);
    expect(game.roomEmits()).toEqual([]);
  });

  it('lists a team’s awards for the bonus drawer', async () => {
    const awardId = await awardShot(1);

    const listed = await game.inRequestContext(() =>
      game.rest.listBonusAwards(game.joinCode, scorer.teamId),
    );

    expect(listed).toEqual({
      teamId: scorer.teamId,
      awards: [expect.objectContaining({ id: awardId, points: 1 })],
    });
  });

  it('refuses every REST method with the unknown-session error for a code with no live session', async () => {
    const calls: (() => Promise<unknown>)[] = [
      () => game.rest.listBonusAwards('NOPE12', scorer.teamId),
      () => game.rest.editBonus('NOPE12', 1, 3, undefined),
      () => game.rest.removeBonus('NOPE12', 1),
      () => game.rest.listAnswers('NOPE12', game.questionIds.multipleChoice),
      () => game.rest.updateSettingsAndLeagues('NOPE12', {}, undefined),
      () => game.rest.closeSession('NOPE12'),
    ];

    for (const call of calls) {
      await expect(game.inRequestContext(call)).rejects.toThrow(
        new UnknownLiveSessionError('NOPE12'),
      );
    }
    expect(game.roomEmits()).toEqual([]);
  });

  it('answers a session closed while the request waited in the queue with the unknown-session error', async () => {
    const awardId = await awardShot(1);
    await game.act('END_QUIZ');
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const awarding = game.inRequestContext(() =>
      game.gameState.awardBonus(game.joinCode, {
        teamId: idle.teamId,
        category: 'shot',
        points: 2,
      }),
    );
    await held.started;

    const waiting = Promise.all([
      game.nextWriteWaiting(),
      game.nextWriteWaiting(),
    ]);
    const closing = game.inRequestContext(() =>
      game.rest.closeSession(game.joinCode),
    );
    const editing = game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, awardId, 3, undefined),
    );
    const outcome = expect(editing).rejects.toBeInstanceOf(
      UnknownLiveSessionError,
    );
    await waiting;
    held.release();

    await awarding;
    await closing;
    await outcome;
  });

  it('shows every team, including 0-point teams, when the leaderboard is toggled on', async () => {
    await game.gateway.handleSubmitAnswer(asSocket(scorer.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: scorer.teamId,
      value: 'Paris',
    });
    game.clearEmits();

    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'TOGGLE_LEADERBOARD',
    });

    expect(lastLeaderboard()).toEqual([
      expect.objectContaining({ teamId: scorer.teamId, totalPoints: 2 }),
      expect.objectContaining({ teamId: idle.teamId, totalPoints: 0 }),
    ]);
  });

  it('still rejects an invalid bonus award with today’s message', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: idle.teamId,
        category: 'custom',
        points: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: 'A custom bonus needs a reason',
    });
    expect(game.roomEmits()).toEqual([]);
  });
});
