import { Logger } from '@nestjs/common';
import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type DisplayStatePayload,
  type LeagueTop,
} from '@campus-pubquiz/types';
import { League } from '@/db/entities/league.entity';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  rejectNthCall,
  setupRealStoreGatewayTest,
  type JoinedTeam,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Live results — league tops refresh when a league table may have changed', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let scorer: JoinedTeam;
  let idle: JoinedTeam;
  let leagueId: number;
  let otherCode: string;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards', 'Idle Team'],
    });
    [scorer, idle] = game.teams;
    const em = game.orm.em.fork();
    const league = em.create(League, {
      name: 'Autumn',
      startsOn: '2019-09-01',
      endsOn: '2999-12-31',
    });
    await em.flush();
    leagueId = league.id;
    await game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {}, [leagueId]),
    );
    otherCode = await createOtherSession([leagueId]);
    await game.openFirstQuestion(await game.connectAdmin());
    await game.gateway.handleSubmitAnswer(asSocket(scorer.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: scorer.teamId,
      value: 'Paris',
    });
    game.clearEmits();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createOtherSession(leagueIds: number[]): Promise<string> {
    const { joinCode } = await game.inRequestContext(() =>
      game.gameState.createSession(
        game.quizId,
        DEFAULT_SESSION_SETTINGS,
        undefined,
        leagueIds,
      ),
    );
    return joinCode;
  }

  /** The league tops the big screen of `joinCode` was sent, in send order. */
  function displayLeagueTops(joinCode: string): (LeagueTop | null)[] {
    const room = sessionRoom(joinCode, SOCKET_ROOMS.DISPLAY);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(room) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => (emit.payload as DisplayStatePayload).leagueTop);
  }

  function emitsTo(joinCode: string) {
    return game
      .roomEmits()
      .filter((emit) =>
        emit.rooms.some(
          (room) => room.startsWith(`${joinCode}`) || room.includes(joinCode),
        ),
      );
  }

  it('redraws another session’s lobby with the new league top when a session ends', async () => {
    await game.act('END_QUIZ');

    const tops = displayLeagueTops(otherCode);
    expect(tops).toHaveLength(1);
    expect(tops[0]?.rows).toEqual([
      expect.objectContaining({ teamName: 'The Quizzards' }),
    ]);
    expect(displayLeagueTops(game.joinCode)).toHaveLength(1);
  });

  it('redraws it again when Previous undoes the end', async () => {
    await game.act('END_QUIZ');
    game.clearEmits();

    await game.act('PREVIOUS');

    const tops = displayLeagueTops(otherCode);
    expect(tops).toEqual([{ name: 'Autumn', rows: [] }]);
  });

  it('redraws it when a bonus edit lands on the ended session', async () => {
    await game.gateway.handleAwardBonus(asSocket(await game.connectAdmin()), {
      teamId: idle.teamId,
      category: 'shot',
      points: 1,
    });
    const [award] = await game.inRequestContext(() =>
      game.bonusService.listForTeamAdmin(game.gameSessionId, idle.teamId),
    );
    await game.act('END_QUIZ');
    const [topAtEnd] = displayLeagueTops(otherCode);
    game.clearEmits();

    await game.inRequestContext(() =>
      game.rest.editBonus(game.joinCode, award.id, 5, undefined),
    );

    const tops = displayLeagueTops(otherCode);
    expect(tops).toHaveLength(1);
    expect(tops[0]).not.toEqual(topAtEnd);
  });

  it('sends the other session nothing for a bonus change on a session that is not ended', async () => {
    await game.gateway.handleAwardBonus(asSocket(await game.connectAdmin()), {
      teamId: scorer.teamId,
      category: 'shot',
      points: 1,
    });

    expect(emitsTo(otherCode)).toEqual([]);
    expect(displayLeagueTops(otherCode)).toEqual([]);
  });

  it('sends the other session nothing for feedback on an ended session', async () => {
    await game.act('END_QUIZ');
    game.clearEmits();

    const ack = await game.gateway.handleSendFeedback(asSocket(scorer.socket), {
      comment: 'Loved it',
      topics: [],
    });

    expect(ack).toEqual({ success: true });
    expect(emitsTo(otherCode)).toEqual([]);
    expect(displayLeagueTops(otherCode)).toEqual([]);
  });

  it('behaves the same for an end delivered with no sender, as a phase timer does', async () => {
    const outcome = await game.inRequestContext(() =>
      game.gameState.applyAdminAction(game.joinCode, 'END_QUIZ'),
    );
    await game.inRequestContext(() =>
      game.broadcaster.deliver(game.joinCode, outcome),
    );

    expect(displayLeagueTops(otherCode)).toHaveLength(1);
  });

  it('sends nothing to a session in a different league', async () => {
    const otherLeague = game.orm.em.fork();
    const league = otherLeague.create(League, {
      name: 'Spring',
      startsOn: '2019-09-01',
      endsOn: '2999-12-31',
    });
    await otherLeague.flush();
    const elsewhere = await createOtherSession([league.id]);
    game.clearEmits();

    await game.act('END_QUIZ');

    expect(displayLeagueTops(elsewhere)).toEqual([]);
    expect(displayLeagueTops(otherCode)).toHaveLength(1);
  });

  it('leaves the other league top as it was and still delivers the outcome when the league read fails', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const failure = new Error('league read down');
    rejectNthCall(game.leagueTableService, 'topFor', failure);

    await game.act('END_QUIZ');

    expect(logged).toHaveBeenCalledWith(
      `League top refresh failed for session ${otherCode}`,
      failure.stack,
    );

    expect(displayLeagueTops(game.joinCode)).toHaveLength(1);
    expect(displayLeagueTops(otherCode)).toEqual([]);
    expect((await game.resync('display', otherCode)).leagueTop).toEqual({
      name: 'Autumn',
      rows: [],
    });
  });

  it('skips a session that closes while the refresh is waiting on it, without logging a failure', async () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const held = game.holdAt('change', { joinCode: otherCode });
    const inProgress = game.sessionWrite.write(otherCode, (session) =>
      Promise.resolve({ session, outcome: null, touchedScores: false }),
    );
    await held.reached;
    const waiting = Promise.all([
      game.nextQueued({ joinCode: otherCode }),
      game.nextQueued({ joinCode: otherCode }),
    ]);
    const closing = game.sessionWrite.remove(otherCode, () => undefined);
    const refreshing = game.gameState.refreshLeagueTops(game.joinCode);
    await waiting;
    held.release();

    await expect(refreshing).resolves.toEqual([]);
    await inProgress;
    await closing;
    expect(game.sessionWrite.has(otherCode)).toBe(false);
    expect(logged).not.toHaveBeenCalled();
  });
});
