import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  advanceToBlockBoard,
  advanceUntil,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — award bonus', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [team] = game.teams;
    game.clearEmits();
  });

  function storedBonuses() {
    return game.inRequestContext(() =>
      game.bonusService.listForTeam(game.gameSessionId, team.teamId),
    );
  }

  it('awards a predefined-category bonus and refreshes the leaderboard for all rooms', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      const snapshots = game.payloadsTo<StateSnapshotPayload>(
        room,
        SOCKET_EVENTS.STATE_UPDATED,
      );
      expect(snapshots[snapshots.length - 1].leaderboard).toEqual([
        expect.objectContaining({
          teamId: team.teamId,
          teamName: 'The Quizzards',
          bonusPoints: 1,
        }),
      ]);
    }
    expect(await storedBonuses()).toEqual([
      expect.objectContaining({ category: 'shot', points: 1 }),
    ]);
  });

  it('stores the block in play on the award and carries it with its team in the live results', async () => {
    await game.act('START_QUIZ');
    await advanceUntil(game, 'question_open');
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    const stored = await game.inRequestContext(() =>
      game.standingsService.scoringRecords(game.gameSessionId),
    );
    expect(stored.bonusAwards).toEqual([
      {
        teamId: team.teamId,
        category: 'shot',
        points: 1,
        blockFirstQuestionId: game.rounds[0].questionIds[0],
      },
    ]);
    expect(
      game.sessionWrite.read(game.joinCode).scoringRecords.bonusAwards,
    ).toEqual(stored.bonusAwards);
  });

  it('stamps an award made in the lobby with the quiz’s first block', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    const stored = await game.inRequestContext(() =>
      game.standingsService.scoringRecords(game.gameSessionId),
    );
    expect(stored.bonusAwards).toEqual([
      expect.objectContaining({
        blockFirstQuestionId: game.rounds[0].questionIds[0],
      }),
    ]);
  });

  it('awards a custom bonus with an admin-written reason', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'custom',
      reason: 'Best team name',
      points: 3,
    });

    expect(await storedBonuses()).toEqual([
      expect.objectContaining({
        category: 'custom',
        points: 3,
        reason: 'Best team name',
      }),
    ]);
  });

  it('pushes the award privately to the awarded team’s own connected socket', async () => {
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'selfie',
      points: 1,
    });

    expect(game.roomEmits()).toContainEqual(
      expect.objectContaining({
        rooms: [team.socket.id],
        event: SOCKET_EVENTS.BONUS_AWARDED,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        payload: expect.objectContaining({ category: 'selfie', points: 1 }),
      }),
    );
  });

  it('does not try to push the award to a team that is not currently connected', async () => {
    await game.gateway.handleDisconnect(asSocket(team.socket));
    game.clearEmits();

    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    expect(game.roomEmits().map((emit) => emit.event)).not.toContain(
      SOCKET_EVENTS.BONUS_AWARDED,
    );
    expect(await storedBonuses()).toHaveLength(1);
  });

  it('rejects AWARD_BONUS from a non-admin client', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(team.socket), {
        teamId: team.teamId,
        category: 'shot',
        points: 1,
      }),
    ).resolves.toMatchObject({ success: false });

    expect(await storedBonuses()).toEqual([]);
  });

  it('surfaces a validation error from BonusService as a WsException', async () => {
    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: team.teamId,
        category: 'custom',
        points: 1,
      }),
    ).resolves.toMatchObject({ success: false });

    expect(await storedBonuses()).toEqual([]);
  });

  it('refuses a bonus in a category the session has disabled, with today’s message', async () => {
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        enabledBonusCategories: ['shot'],
      }),
    );

    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: team.teamId,
        category: 'selfie',
        points: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: expect.stringContaining(
        '"selfie" is not enabled for this session',
      ) as string,
    });
  });

  it('refuses a bonus over the per-category limit, with today’s message', async () => {
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        maxBonusAwardsPerCategory: { shot: 1 },
      }),
    );
    const award = () =>
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: team.teamId,
        category: 'shot',
        points: 1,
      });
    await award();

    await expect(award()).resolves.toEqual({
      success: false,
      error: expect.stringContaining(
        'This team has already been awarded the "shot" bonus the maximum 1 time(s)',
      ) as string,
    });
  });
});

describe('GameGateway — bonus in a fresh round intro, the previous block’s board up', () => {
  const harness = setupRealStoreGatewayTest();
  const mcQuestion = {
    type: 'multiple_choice' as const,
    prompt: 'Capital of France?',
    answer: 'Paris',
    points: 2,
    payload: { options: ['Paris', 'London'] },
  };

  // Three blocks: the third block's intro must stamp block 2, not block 1.
  async function awardAtThirdBlockIntro(restart: boolean) {
    let game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: ['One', 'Two', 'Three'].map((title) => ({
        title,
        breakAfter: true,
        questions: [mcQuestion],
      })),
    });
    let admin = await game.connectAdmin();
    await game.act('START_QUIZ');
    await advanceToBlockBoard(game);
    await game.act('ADVANCE');
    await advanceUntil(game, 'question_open'); // the board of block 1 is still up until here
    await advanceToBlockBoard(game);
    await game.act('ADVANCE');
    expect(game.sessionWrite.read(game.joinCode).progress).toMatchObject({
      status: 'round_intro',
      roundIndex: 2,
    });
    const { teamId } = game.teams[0];
    if (restart) {
      game = await game.restart();
      admin = await game.connectAdmin();
      expect(game.sessionWrite.read(game.joinCode).progress).toMatchObject({
        status: 'round_intro',
        roundIndex: 2,
      });
    }
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId,
      category: 'shot',
      points: 1,
    });
    const stored = await game.inRequestContext(() =>
      game.standingsService.scoringRecords(game.gameSessionId),
    );
    return { stored, playedBlockId: game.rounds[1].questionIds[0] };
  }

  it('stamps the award with the block just played', async () => {
    const { stored, playedBlockId } = await awardAtThirdBlockIntro(false);
    expect(stored.bonusAwards).toEqual([
      expect.objectContaining({ blockFirstQuestionId: playedBlockId }),
    ]);
  });

  it('still does after a backend restart, when there are no prior standings', async () => {
    const { stored, playedBlockId } = await awardAtThirdBlockIntro(true);
    expect(stored.bonusAwards).toEqual([
      expect.objectContaining({ blockFirstQuestionId: playedBlockId }),
    ]);
  });
});
