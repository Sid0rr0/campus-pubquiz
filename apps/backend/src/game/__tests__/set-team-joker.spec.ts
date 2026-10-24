import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
  type TeamJoker,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type CreateGatewayOptions,
  type JoinedTeam,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const THREE_ROUNDS: QuizRoundSpec[] = [1, 2, 3].map((number) => ({
  title: `Round ${number}`,
  breakAfter: true,
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: `Question of round ${number}?`,
      answer: 'right',
      points: 1,
      payload: { options: ['right', 'wrong'] },
    },
  ],
}));

describe('GameGateway — the quiz master changing a team’s joker', () => {
  const harness = setupRealStoreGatewayTest();

  function jokerNight(options: CreateGatewayOptions = {}) {
    return harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha', 'Bravo'],
      settings: { showRoundOverview: true, jokersEnabled: true },
      ...options,
    });
  }

  async function openPick(game: RealStoreGateway) {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    return game.act('ADVANCE'); // -> joker_pick
  }

  async function setJoker(
    game: RealStoreGateway,
    teamId: number,
    roundId: number,
  ): Promise<AckResult> {
    const admin = await game.connectAdmin();
    return game.gateway.handleSetTeamJoker(asSocket(admin), {
      teamId,
      roundId,
    });
  }

  function syncsTo(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
  ): unknown[] {
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(team.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_JOKER_SYNCED,
      )
      .map((emit) => emit.payload);
  }

  async function adminJokers(game: RealStoreGateway) {
    const view = await game.snapshot();
    return Object.fromEntries(
      view.teams.map(({ teamName, joker }) => [
        teamName,
        joker && { roundId: joker.roundId, source: joker.source },
      ]),
    );
  }

  async function storedJokers(game: RealStoreGateway) {
    return game.inRequestContext(async () =>
      Object.fromEntries(
        await game.jokerService.listForSession(game.gameSessionId),
      ),
    );
  }

  it('sets a team’s joker during the pick, marked as set by the quiz master, and tells only that team', async () => {
    const game = await jokerNight();
    await openPick(game);
    const [alpha, bravo] = game.teams;
    game.clearEmits();

    const ack = await setJoker(game, alpha.teamId, game.rounds[1].id);

    expect(ack).toEqual({ success: true });
    const expected: TeamJoker = {
      roundId: game.rounds[1].id,
      source: 'set_by_quiz_master',
    };
    expect(syncsTo(game, alpha)).toEqual([{ joker: expected }]);
    expect(syncsTo(game, bravo)).toEqual([]);
    expect(await adminJokers(game)).toEqual({
      Alpha: expected,
      Bravo: null,
    });
    expect(await storedJokers(game)).toEqual({ [alpha.teamId]: expected });
    expect(
      game.payloadsTo(SOCKET_ROOMS.PLAYERS, SOCKET_EVENTS.STATE_UPDATED),
    ).toEqual([]);
  });

  it('replaces a team’s own pick, and the team can pick again while the pick is open', async () => {
    const game = await jokerNight();
    await openPick(game);
    const [alpha] = game.teams;
    await game.gateway.handlePickJoker(asSocket(alpha.socket), {
      roundId: game.rounds[0].id,
    });

    await setJoker(game, alpha.teamId, game.rounds[2].id);

    expect((await adminJokers(game)).Alpha).toEqual({
      roundId: game.rounds[2].id,
      source: 'set_by_quiz_master',
    });
    await game.gateway.handlePickJoker(asSocket(alpha.socket), {
      roundId: game.rounds[1].id,
    });
    expect((await adminJokers(game)).Alpha).toEqual({
      roundId: game.rounds[1].id,
      source: 'chosen',
    });
  });

  it('still changes a joker after the pick has closed, until that round starts', async () => {
    const game = await jokerNight();
    await openPick(game);
    await game.act('ADVANCE'); // closes the pick -> round_intro
    const [alpha] = game.teams;

    const ack = await setJoker(game, alpha.teamId, game.rounds[2].id);

    expect(ack).toEqual({ success: true });
    expect((await adminJokers(game)).Alpha?.roundId).toBe(game.rounds[2].id);
  });

  it('refuses a round that has an opened question and stores nothing', async () => {
    // 0.99 always draws the last pickable round.
    const game = await jokerNight({ jokerRandom: () => 0.99 });
    await openPick(game);
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open, round 1 has started
    const [alpha] = game.teams;
    game.clearEmits();

    const ack = await setJoker(game, alpha.teamId, game.rounds[0].id);

    expect(ack.success).toBe(false);
    // Alpha keeps the joker drawn for it when the pick closed.
    expect((await adminJokers(game)).Alpha).toEqual({
      roundId: game.rounds[2].id,
      source: 'drawn',
    });
    expect(syncsTo(game, alpha)).toEqual([]);
  });

  it('refreshes the admin room, not the big screen, and refreshes the standings', async () => {
    const game = await jokerNight();
    await openPick(game);
    const [alpha] = game.teams;
    game.clearEmits();
    const held = game.holdAt('standings');

    const setting = setJoker(game, alpha.teamId, game.rounds[1].id);
    await held.reached;
    held.release();
    await setting;

    const adminUpdates = game.payloadsTo<{
      teams: { teamName: string; joker: { roundId: number } | null }[];
    }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.STATE_UPDATED);
    expect(adminUpdates).toHaveLength(1);
    expect(
      adminUpdates[0].teams.find((team) => team.teamName === 'Alpha')?.joker
        ?.roundId,
    ).toBe(game.rounds[1].id);
    expect(
      game.payloadsTo(SOCKET_ROOMS.DISPLAY, SOCKET_EVENTS.STATE_UPDATED),
    ).toEqual([]);
  });

  it('refuses a team that is not in the session, naming it', async () => {
    const game = await jokerNight();
    await openPick(game);

    const ack = await setJoker(game, 999_999, game.rounds[0].id);

    expect(ack).toEqual({
      success: false,
      error: 'Team 999999 is not in this session',
    });
    expect(await storedJokers(game)).toEqual({});
  });

  it('refuses a round that is not in the quiz', async () => {
    const game = await jokerNight();
    await openPick(game);

    const ack = await setJoker(game, game.teams[0].teamId, 999_999);

    expect(ack).toEqual({
      success: false,
      error:
        'That round cannot be the joker: it has already started, or the joker pick has not opened',
    });
    expect(await storedJokers(game)).toEqual({});
  });

  it('refuses before the pick has opened', async () => {
    const game = await jokerNight();
    await game.act('START_QUIZ');

    const ack = await setJoker(game, game.teams[0].teamId, game.rounds[0].id);

    expect(ack.success).toBe(false);
    expect(await storedJokers(game)).toEqual({});
  });

  it('refuses when the session plays without jokers', async () => {
    const game = await jokerNight({
      settings: { showRoundOverview: true, jokersEnabled: false },
    });
    await game.act('START_QUIZ');
    await game.act('ADVANCE');
    await game.act('ADVANCE');

    const ack = await setJoker(game, game.teams[0].teamId, game.rounds[2].id);

    expect(ack.success).toBe(false);
    expect(await storedJokers(game)).toEqual({});
  });
});
