import {
  JOKER_PICK_SECONDS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AckResult,
  type TeamJoker,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceClockBy,
  freezeClockAt,
  restoreClock,
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

const FROZEN_NOW = '2024-01-01T00:00:00.000Z';
const JOKER_NIGHT_SETTINGS = { showRoundOverview: true, jokersEnabled: true };

describe('GameGateway — the joker pick', () => {
  const harness = setupRealStoreGatewayTest();

  function jokerNight(options: CreateGatewayOptions = {}) {
    return harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha', 'Bravo'],
      settings: JOKER_NIGHT_SETTINGS,
      ...options,
    });
  }

  /** Starts the quiz and advances to the joker pick. */
  async function openPick(game: RealStoreGateway) {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    return game.act('ADVANCE'); // -> joker_pick
  }

  function pick(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
    roundId: number,
  ): Promise<AckResult> {
    return game.gateway.handlePickJoker(asSocket(team.socket), { roundId });
  }

  /** The joker syncs the server addressed to this team's socket, in emit order. */
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

  /** Every team's joker as the quiz master sees it, by team name (round and source only). */
  async function adminJokers(game: RealStoreGateway) {
    const view = await game.snapshot();
    return Object.fromEntries(
      view.teams.map(({ teamName, joker }) => [
        teamName,
        joker && { roundId: joker.roundId, source: joker.source },
      ]),
    );
  }

  /** The round number and title the quiz master reads for a team's joker. */
  async function adminJokerRound(game: RealStoreGateway, teamName: string) {
    const view = await game.snapshot();
    const joker = view.teams.find((team) => team.teamName === teamName)?.joker;
    return joker && [joker.roundNumber, joker.roundTitle];
  }

  async function storedJokers(game: RealStoreGateway) {
    return game.inRequestContext(async () =>
      Object.fromEntries(
        await game.jokerService.listForSession(game.gameSessionId),
      ),
    );
  }

  /** The joker the JOIN_ACCEPTED a socket received carried. */
  function joinedJoker(socket: JoinedTeam['socket']): TeamJoker | null {
    const accepted = socket.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
    ) as [string, { joker: TeamJoker | null }];
    return accepted[1].joker;
  }

  describe('moving through it', () => {
    it('goes from the round overview to the joker pick and on to the first round intro', async () => {
      const game = await jokerNight();

      const picking = await openPick(game);
      const afterPick = await game.act('ADVANCE');

      expect(picking.progress.status).toBe('joker_pick');
      expect(picking.onAirScreen).toEqual({ kind: 'joker_pick' });
      expect(afterPick.progress.status).toBe('round_intro');
      expect(afterPick.progress.roundIndex).toBe(0);
    });

    it('goes back from the joker pick to the round overview', async () => {
      const game = await jokerNight();
      await openPick(game);

      const back = await game.act('PREVIOUS');

      expect(back.progress.status).toBe('round_overview');
      expect(game.timers().jokerPick.isArmed()).toBe(false);
    });

    it('takes the unchanged path past the overview with jokers off', async () => {
      const game = await jokerNight({
        settings: { showRoundOverview: true, jokersEnabled: false },
      });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // -> round_overview

      const next = await game.act('ADVANCE');

      expect(next.progress.status).toBe('round_intro');
      expect(game.timers().jokerPick.isArmed()).toBe(false);
    });
  });

  describe('the deadline', () => {
    beforeEach(() => freezeClockAt(FROZEN_NOW));
    afterEach(() => restoreClock());

    it('is a fixed minute after the pick opens, shown to the big screen and the phones', async () => {
      const game = await jokerNight();

      await openPick(game);

      const endsAt = Date.now() + JOKER_PICK_SECONDS * 1000;
      expect(game.timers().jokerPick.dueAt()).toBe(endsAt);
      const display = await game.resync('display');
      expect(display.screen).toMatchObject({ kind: 'joker_pick', endsAt });
      const players = await game.resync('players');
      expect(players.jokerPick?.endsAt).toBe(endsAt);
    });

    it('is cleared when the pick is left', async () => {
      const game = await jokerNight();
      await openPick(game);

      await game.act('ADVANCE');

      expect(game.timers().jokerPick.isArmed()).toBe(false);
      expect((await game.resync('players')).jokerPick).toBeNull();
    });

    it('is not extended by showing the join overlay on the pick', async () => {
      const game = await jokerNight();
      await openPick(game);
      const dueAt = game.timers().jokerPick.dueAt();
      advanceClockBy(20_000);

      await game.act('TOGGLE_JOIN_OVERLAY');

      expect(game.timers().jokerPick.dueAt()).toBe(dueAt);
    });

    it('presses Advance when it expires, moving to the first round intro', async () => {
      const game = await jokerNight();
      await openPick(game);

      await game.timers().jokerPick.fireNow();

      const view = await game.snapshot();
      expect(view.progress.status).toBe('round_intro');
      expect(game.timers().jokerPick.isArmed()).toBe(false);
    });

    it('is re-armed after a restart while the pick is open', async () => {
      const game = await jokerNight();
      await openPick(game);
      advanceClockBy(10_000);

      const restarted = await game.restart();

      expect(restarted.timers().jokerPick.isArmed()).toBe(true);
      expect(restarted.timers().jokerPick.dueAt()).toBe(
        Date.now() + JOKER_PICK_SECONDS * 1000,
      );
      const players = await restarted.resync('players');
      expect(players.phoneScreen).toEqual({ kind: 'joker_pick', isOpen: true });
      await restarted.timers().jokerPick.fireNow();
      expect((await restarted.snapshot()).progress.status).toBe('round_intro');
    });
  });

  describe('a team picking', () => {
    it('saves the pick and tells only that team’s phone', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha, bravo] = game.teams;
      game.clearEmits();

      const ack = await pick(game, alpha, game.rounds[1].id);

      expect(ack).toEqual({ success: true });
      const expected: TeamJoker = {
        roundId: game.rounds[1].id,
        source: 'chosen',
      };
      expect(syncsTo(game, alpha)).toEqual([{ joker: expected }]);
      expect(syncsTo(game, bravo)).toEqual([]);
      expect(await storedJokers(game)).toEqual({ [alpha.teamId]: expected });
    });

    it('keeps the last pick when the team changes its mind', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha] = game.teams;

      await pick(game, alpha, game.rounds[0].id);
      await pick(game, alpha, game.rounds[2].id);

      expect((await adminJokers(game)).Alpha).toEqual({
        roundId: game.rounds[2].id,
        source: 'chosen',
      });
    });

    it('lists every team’s joker with its source to the quiz master, and to nobody else', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha] = game.teams;
      game.clearEmits();

      await pick(game, alpha, game.rounds[1].id);

      expect(await adminJokers(game)).toEqual({
        Alpha: { roundId: game.rounds[1].id, source: 'chosen' },
        Bravo: null,
      });
      expect(await adminJokerRound(game, 'Alpha')).toEqual([2, 'Round 2']);
      const secret = JSON.stringify({
        display: await game.resync('display'),
        players: await game.resync('players'),
      });
      expect(secret).not.toContain('"chosen"');
      expect(secret).not.toContain('"joker"');
      expect(
        game.payloadsTo(SOCKET_ROOMS.PLAYERS, SOCKET_EVENTS.STATE_UPDATED),
      ).toEqual([]);
      expect(
        game.payloadsTo(SOCKET_ROOMS.DISPLAY, SOCKET_EVENTS.STATE_UPDATED),
      ).toEqual([]);
    });

    it('offers the phone every round while none has started', async () => {
      const game = await jokerNight();
      await openPick(game);

      const players = await game.resync('players');

      expect(players.jokerPick?.rounds.map((round) => round.title)).toEqual([
        'Round 1',
        'Round 2',
        'Round 3',
      ]);
    });

    it('lists every round with its number to the big screen', async () => {
      const game = await jokerNight();
      await openPick(game);

      const display = await game.resync('display');

      expect(display.screen.kind).toBe('joker_pick');
      if (display.screen.kind !== 'joker_pick') return;
      expect(display.screen.rounds.map((r) => r.roundNumber)).toEqual([
        1, 2, 3,
      ]);
    });

    it('refuses a pick outside the joker pick and stores nothing', async () => {
      const game = await jokerNight();
      await game.act('START_QUIZ');
      const [alpha] = game.teams;

      const ack = await pick(game, alpha, game.rounds[0].id);

      expect(ack).toEqual({
        success: false,
        error: 'The joker pick is not open',
      });
      expect(await storedJokers(game)).toEqual({});
    });

    it('refuses a pick once the pick has closed', async () => {
      const game = await jokerNight();
      await openPick(game);
      await game.act('ADVANCE'); // closes the pick
      const [alpha] = game.teams;

      const ack = await pick(game, alpha, game.rounds[0].id);

      expect(ack.success).toBe(false);
    });

    it('refuses a round that is not in the quiz', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha] = game.teams;

      const ack = await pick(game, alpha, 999_999);

      expect(ack.success).toBe(false);
      expect(await storedJokers(game)).toEqual({});
    });

    it('refuses a pick from a socket that has joined no team', async () => {
      const game = await jokerNight();
      await openPick(game);
      const stranger = await game.connectPlayer();

      const ack = await pick(game, { socket: stranger }, game.rounds[0].id);

      expect(ack).toEqual({
        success: false,
        error: 'Join a team before picking a joker',
      });
    });
  });

  describe('closing the pick', () => {
    it('draws a joker for each team without one when the quiz master advances, keeping the picks', async () => {
      // 0.99 always draws the last pickable round.
      const game = await jokerNight({ jokerRandom: () => 0.99 });
      await openPick(game);
      const [alpha, bravo] = game.teams;
      await pick(game, alpha, game.rounds[0].id);
      game.clearEmits();

      await game.act('ADVANCE');

      expect(await adminJokers(game)).toEqual({
        Alpha: { roundId: game.rounds[0].id, source: 'chosen' },
        Bravo: { roundId: game.rounds[2].id, source: 'drawn' },
      });
      expect(syncsTo(game, bravo)).toEqual([
        { joker: { roundId: game.rounds[2].id, source: 'drawn' } },
      ]);
      expect(syncsTo(game, alpha)).toEqual([
        { joker: { roundId: game.rounds[0].id, source: 'chosen' } },
      ]);
    });

    it('draws when the deadline presses Advance too', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);

      await game.timers().jokerPick.fireNow();

      expect(await adminJokers(game)).toEqual({
        Alpha: { roundId: game.rounds[0].id, source: 'drawn' },
        Bravo: { roundId: game.rounds[0].id, source: 'drawn' },
      });
    });

    it('draws with equal chance across the rounds', async () => {
      const draws = [0, 0.4, 0.7];
      const game = await jokerNight({
        teamNames: ['Alpha', 'Bravo', 'Charlie'],
        jokerRandom: () => draws.shift() ?? 0,
      });
      await openPick(game);

      await game.act('ADVANCE');

      expect(
        Object.values(await adminJokers(game)).map((joker) => joker?.roundId),
      ).toEqual(game.rounds.map((round) => round.id));
    });

    it('draws when the quiz master goes back from the pick, too', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);

      await game.act('PREVIOUS');

      expect(Object.values(await adminJokers(game))).toEqual([
        { roundId: game.rounds[0].id, source: 'drawn' },
        { roundId: game.rounds[0].id, source: 'drawn' },
      ]);
    });

    it('draws for a team on the roster that has not rejoined since a restart, and keeps a stored pick', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);
      const [alpha, bravo] = game.teams;
      await pick(game, alpha, game.rounds[2].id);

      const restarted = await game.restart();
      await restarted.act('ADVANCE');

      expect(await storedJokers(restarted)).toEqual({
        [alpha.teamId]: { roundId: game.rounds[2].id, source: 'chosen' },
        [bravo.teamId]: { roundId: game.rounds[0].id, source: 'drawn' },
      });
    });
  });

  describe('reopening the pick', () => {
    beforeEach(() => freezeClockAt(FROZEN_NOW));
    afterEach(() => restoreClock());

    /** Closes the pick and steps back into it from round 0's intro. */
    async function reopen(game: RealStoreGateway) {
      await game.act('ADVANCE'); // closes the pick -> round_intro
      game.clearEmits();
      return game.act('PREVIOUS');
    }

    it('goes back from round 0’s intro to the pick with a fresh minute', async () => {
      const game = await jokerNight();
      await openPick(game);
      await game.act('ADVANCE');
      advanceClockBy(45_000);

      const back = await game.act('PREVIOUS');

      expect(back.progress.status).toBe('joker_pick');
      expect(game.timers().jokerPick.dueAt()).toBe(
        Date.now() + JOKER_PICK_SECONDS * 1000,
      );
      expect((await game.resync('players')).jokerPick?.endsAt).toBe(
        Date.now() + JOKER_PICK_SECONDS * 1000,
      );
    });

    it('keeps chosen and quiz-master-set jokers and clears drawn ones', async () => {
      const game = await jokerNight({
        teamNames: ['Alpha', 'Bravo', 'Charlie'],
        jokerRandom: () => 0,
      });
      await openPick(game);
      const [alpha, , charlie] = game.teams;
      await pick(game, alpha, game.rounds[1].id);
      await game.inRequestContext(() =>
        game.jokerService.set(game.gameSessionId, charlie.teamId, {
          roundId: game.rounds[2].id,
          source: 'set_by_quiz_master',
        }),
      );
      await game.act('ADVANCE'); // Bravo is drawn round 1

      await game.act('PREVIOUS');

      expect(await adminJokers(game)).toEqual({
        Alpha: { roundId: game.rounds[1].id, source: 'chosen' },
        Bravo: null,
        Charlie: { roundId: game.rounds[2].id, source: 'set_by_quiz_master' },
      });
      expect(Object.keys(await storedJokers(game))).not.toContain(
        String(game.teams[1].teamId),
      );
    });

    it('tells a team whose drawn joker was cleared that it has none', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);
      const [alpha, bravo] = game.teams;
      await pick(game, alpha, game.rounds[1].id);

      await reopen(game);

      expect(syncsTo(game, bravo)).toEqual([{ joker: null }]);
      expect(syncsTo(game, alpha)).toEqual([]);
    });

    it('gives the teams that did not choose a fresh draw when it closes again', async () => {
      const game = await jokerNight({ jokerRandom: () => 0.99 });
      await openPick(game);
      const [, bravo] = game.teams;
      await game.act('ADVANCE'); // both drawn the last round
      await game.act('PREVIOUS');
      await pick(game, bravo, game.rounds[0].id);

      await game.act('ADVANCE');

      expect(await adminJokers(game)).toEqual({
        Alpha: { roundId: game.rounds[2].id, source: 'drawn' },
        Bravo: { roundId: game.rounds[0].id, source: 'chosen' },
      });
    });

    describe('once a round has started', () => {
      /** Opens round 0's question, then steps back into the pick. */
      async function reopenAfterRoundStarted(game: RealStoreGateway) {
        await openPick(game);
        await game.act('ADVANCE'); // closes the pick -> round_intro
        await game.act('ADVANCE'); // -> question_open, round 0 started
        await game.act('PREVIOUS'); // -> round_intro
        game.clearEmits();
        return game.act('PREVIOUS'); // -> joker_pick
      }

      it('offers only the rounds with no opened question', async () => {
        const game = await jokerNight();
        await reopenAfterRoundStarted(game);

        const players = await game.resync('players');

        expect(players.jokerPick?.rounds.map((round) => round.title)).toEqual([
          'Round 2',
          'Round 3',
        ]);
        const display = await game.resync('display');
        if (display.screen.kind !== 'joker_pick') throw new Error('not pick');
        expect(display.screen.rounds.map((round) => round.roundNumber)).toEqual(
          [2, 3],
        );
      });

      it('refuses a pick of the started round and stores nothing', async () => {
        const game = await jokerNight();
        await reopenAfterRoundStarted(game);
        const [alpha] = game.teams;

        const ack = await pick(game, alpha, game.rounds[0].id);

        expect(ack.success).toBe(false);
        expect((await adminJokers(game)).Alpha).toBeNull();
      });

      it('still lets a team move to a round that has not started', async () => {
        const game = await jokerNight();
        await reopenAfterRoundStarted(game);
        const [alpha] = game.teams;

        const ack = await pick(game, alpha, game.rounds[1].id);

        expect(ack).toEqual({ success: true });
      });

      it('never draws the started round', async () => {
        const game = await jokerNight({ jokerRandom: () => 0 });
        await reopenAfterRoundStarted(game);

        await game.act('ADVANCE');

        expect(await adminJokers(game)).toEqual({
          Alpha: { roundId: game.rounds[1].id, source: 'drawn' },
          Bravo: { roundId: game.rounds[1].id, source: 'drawn' },
        });
      });

      it('keeps a chosen joker that sits on the started round', async () => {
        const game = await jokerNight();
        await openPick(game);
        const [alpha] = game.teams;
        await pick(game, alpha, game.rounds[0].id);
        await game.act('ADVANCE');
        await game.act('ADVANCE');
        await game.act('PREVIOUS');

        await game.act('PREVIOUS');

        expect((await adminJokers(game)).Alpha).toEqual({
          roundId: game.rounds[0].id,
          source: 'chosen',
        });
      });
    });
  });

  describe('reconnecting and rejoining', () => {
    it('hands a rejoining phone its own joker in JOIN_ACCEPTED', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha, bravo] = game.teams;
      await pick(game, alpha, game.rounds[1].id);
      await pick(game, bravo, game.rounds[2].id);
      const phone = await game.connectPlayer();

      await game.gateway.handleJoinPlayers(asSocket(phone), {
        teamName: 'Alpha',
        teamToken: alpha.teamToken,
        joinCode: game.joinCode,
        previousSocketId: alpha.socket.id,
      });

      expect(joinedJoker(phone)).toEqual({
        roundId: game.rounds[1].id,
        source: 'chosen',
      });
    });

    it('keeps the joker through a kick and a rejoin with the team code', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha] = game.teams;
      await pick(game, alpha, game.rounds[1].id);
      const admin = await game.connectAdmin();
      await game.gateway.handleKickTeam(asSocket(admin), {
        teamId: alpha.teamId,
      });
      const phone = await game.connectPlayer();

      await game.gateway.handleJoinPlayers(asSocket(phone), {
        teamName: 'Alpha',
        teamCode: alpha.teamCode,
        joinCode: game.joinCode,
      });

      expect(joinedJoker(phone)).toEqual({
        roundId: game.rounds[1].id,
        source: 'chosen',
      });
      expect((await adminJokers(game)).Alpha).toEqual({
        roundId: game.rounds[1].id,
        source: 'chosen',
      });
    });

    it('carries a null joker for a team that has none yet', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha] = game.teams;
      const phone = await game.connectPlayer();

      await game.gateway.handleJoinPlayers(asSocket(phone), {
        teamName: 'Alpha',
        teamToken: alpha.teamToken,
        joinCode: game.joinCode,
        previousSocketId: alpha.socket.id,
      });

      expect(joinedJoker(phone)).toBeNull();
    });

    it('lets a team that joins during the pick choose like everyone else', async () => {
      const game = await jokerNight();
      await openPick(game);
      const latecomer = await game.joinTeam('Charlie');

      const ack = await pick(game, latecomer, game.rounds[0].id);

      expect(ack).toEqual({ success: true });
    });
  });
});
