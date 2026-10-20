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
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import {
  BonusAwardNotFoundError,
  InvalidBonusAwardError,
} from '@/bonus/bonus.service';
import { UnknownLiveSessionError } from '@/game/rest/live-session-rest.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';

describe('GameGateway — bonus changed and leaderboard toggle', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let scorer: JoinedTeam;
  let idle: JoinedTeam;

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

  function bonusSyncs() {
    return game
      .roomEmits()
      .filter((emit) => emit.event === SOCKET_EVENTS.TEAM_BONUS_AWARDS_SYNCED);
  }

  it('syncs an edited award to the awarded team’s socket only, without a toast', async () => {
    const awardId = await awardShot(1);

    await game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, awardId, 3, undefined),
    );

    expect(bonusSyncs()).toEqual([
      expect.objectContaining({
        rooms: [scorer.socket.id],
        payload: {
          bonusAwards: [{ category: 'shot', points: 3, reason: null }],
        },
      }),
    ]);
    expect(game.roomEmits().map((emit) => emit.event)).not.toContain(
      SOCKET_EVENTS.BONUS_AWARDED,
    );
  });

  it('syncs a deletion to the awarded team’s socket with the award gone', async () => {
    const awardId = await awardShot(1);

    await game.inRequestContext(() =>
      game.rest.removeBonus(game.joinCode, awardId),
    );

    expect(bonusSyncs()).toEqual([
      expect.objectContaining({
        rooms: [scorer.socket.id],
        payload: { bonusAwards: [] },
      }),
    ]);
  });

  it('sends a disconnected team no sync, and its rejoin carries the current list', async () => {
    const awardId = await awardShot(1);
    await game.gateway.handleDisconnect(asSocket(scorer.socket));
    game.clearEmits();

    await game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, awardId, 3, undefined),
    );
    expect(bonusSyncs()).toEqual([]);

    const rejoined = await game.connectPlayer();
    await game.gateway.handleJoinPlayers(asSocket(rejoined), {
      teamName: 'The Quizzards',
      joinCode: game.joinCode,
      teamCode: scorer.teamCode,
    });
    expect(rejoined.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.JOIN_ACCEPTED,
      expect.objectContaining({
        bonusAwards: [{ category: 'shot', points: 3, reason: null }],
      }),
    );
  });

  it('keeps the toast and sends no sync for a fresh award', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: scorer.teamId,
      category: 'shot',
      points: 1,
    });

    expect(game.roomEmits().map((emit) => emit.event)).toContain(
      SOCKET_EVENTS.BONUS_AWARDED,
    );
    expect(bonusSyncs()).toEqual([]);
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

  it('lets a session refusal that is not about the bonus award pass through a REST bonus edit or deletion unchanged', async () => {
    const refusal = new SessionRefusal('Something else was refused');
    jest.spyOn(game.gameState, 'editBonus').mockRejectedValue(refusal);
    jest.spyOn(game.gameState, 'removeBonus').mockRejectedValue(refusal);

    await expect(
      game.inRequestContext(() =>
        game.rest.editBonus(game.joinCode, 1, 3, undefined),
      ),
    ).rejects.toBe(refusal);
    await expect(
      game.inRequestContext(() => game.rest.removeBonus(game.joinCode, 1)),
    ).rejects.toBe(refusal);
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
      () =>
        game.rest.updateSettingsAndLeagues('NOPE12', () => {
          throw new Error('an unknown session never parses the request');
        }),
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
