import {
  SOCKET_EVENTS,
  type TeamJoker,
  type TeamJokerSyncedPayload,
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

describe('GameGateway — every team keeps exactly one joker', () => {
  const harness = setupRealStoreGatewayTest();

  function jokerNight(options: CreateGatewayOptions = {}) {
    return harness.createGateway({
      rounds: THREE_ROUNDS,
      teamNames: ['Alpha', 'Bravo'],
      settings: { showRoundOverview: true, jokersEnabled: true },
      ...options,
    });
  }

  /** Starts the quiz and advances to the joker pick. */
  async function openPick(game: RealStoreGateway) {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_overview
    return game.act('ADVANCE'); // -> joker_pick
  }

  /** The joker syncs the server addressed to this team's socket, in emit order. */
  function syncsTo(
    game: RealStoreGateway,
    team: Pick<JoinedTeam, 'socket'>,
  ): TeamJokerSyncedPayload[] {
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(team.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_JOKER_SYNCED,
      )
      .map((emit) => emit.payload as TeamJokerSyncedPayload);
  }

  async function adminJokers(game: RealStoreGateway) {
    const view = await game.snapshot();
    return Object.fromEntries(
      view.teams.map(({ teamName, joker }) => [
        teamName,
        joker && [joker.roundNumber, joker.roundTitle, joker.source],
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

  function joinedJoker(socket: JoinedTeam['socket']): TeamJoker | null {
    const accepted = socket.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.JOIN_ACCEPTED,
    ) as [string, { joker: TeamJoker | null }];
    return accepted[1].joker;
  }

  describe('a team joining after the pick closed', () => {
    it('is drawn a round that has not started, and told so', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);
      await game.act('ADVANCE'); // closes the pick -> round_intro
      await game.act('ADVANCE'); // -> question_open, round 1 started
      game.clearEmits();

      const latecomer = await game.joinTeam('Charlie');

      expect((await adminJokers(game)).Charlie).toEqual([
        2,
        'Round 2',
        'drawn',
      ]);
      expect(await storedJokers(game)).toMatchObject({
        [latecomer.teamId]: { roundId: game.rounds[1].id, source: 'drawn' },
      });
      expect(syncsTo(game, latecomer)).toEqual([
        { joker: { roundId: game.rounds[1].id, source: 'drawn' } },
      ]);
      // The reply is built before the draw reaches the phone, so the phone
      // sees the draw as a change (and toasts it), not as a joker it held.
      expect(joinedJoker(latecomer.socket)).toBeNull();
    });

    it('is not drawn a joker before the pick has opened; the close draws it then', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await game.act('START_QUIZ'); // -> rules

      await game.joinTeam('Charlie');

      expect((await adminJokers(game)).Charlie).toBeNull();
      await game.act('ADVANCE'); // -> round_overview
      await game.act('ADVANCE'); // -> joker_pick
      await game.act('ADVANCE'); // closes the pick
      expect((await adminJokers(game)).Charlie).toEqual([
        1,
        'Round 1',
        'drawn',
      ]);
    });

    it('is not drawn a joker while the pick is open; the close draws it then', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);

      const latecomer = await game.joinTeam('Charlie');

      expect(await storedJokers(game)).toEqual({});
      expect(syncsTo(game, latecomer)).toEqual([]);
      await game.act('ADVANCE'); // closes the pick
      expect((await adminJokers(game)).Charlie).toEqual([
        1,
        'Round 1',
        'drawn',
      ]);
    });

    it('is not drawn a joker once the quiz has ended', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);
      await game.act('ADVANCE'); // closes the pick -> round_intro
      await game.act('END_QUIZ');
      const before = await storedJokers(game);

      const latecomer = await game.joinTeam('Charlie');

      expect(await storedJokers(game)).toEqual(before);
      expect(syncsTo(game, latecomer)).toEqual([]);
    });

    it('is not drawn a joker in a session played without jokers', async () => {
      const game = await jokerNight({
        settings: { showRoundOverview: true, jokersEnabled: false },
      });
      await game.act('START_QUIZ');
      await game.act('ADVANCE');
      await game.act('ADVANCE');

      await game.joinTeam('Charlie');

      expect(await storedJokers(game)).toEqual({});
    });

    it('keeps the joker it already holds when it rejoins', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await openPick(game);
      await game.act('ADVANCE');
      const [alpha] = game.teams;
      const phone = await game.connectPlayer();
      game.clearEmits();

      await game.gateway.handleJoinPlayers(asSocket(phone), {
        teamName: 'Alpha',
        teamToken: alpha.teamToken,
        joinCode: game.joinCode,
        previousSocketId: alpha.socket.id,
      });

      expect(joinedJoker(phone)).toEqual({
        roundId: game.rounds[0].id,
        source: 'drawn',
      });
      expect(
        game
          .roomEmits()
          .filter((emit) => emit.event === SOCKET_EVENTS.TEAM_JOKER_SYNCED),
      ).toEqual([]);
    });
  });

  describe('a live edit that changes the rounds', () => {
    async function pastThePick(game: RealStoreGateway) {
      await openPick(game);
      await game.act('ADVANCE'); // closes the pick -> round_intro(round 1)
    }

    it('redraws the joker of a deleted round inside the same save and syncs the team', async () => {
      const game = await jokerNight({ jokerRandom: () => 0.99 });
      await openPick(game);
      const [alpha, bravo] = game.teams;
      await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[2].id,
      });
      await game.gateway.handlePickJoker(asSocket(bravo.socket), {
        roundId: game.rounds[1].id,
      });
      await game.act('ADVANCE');
      game.clearEmits();

      await game.saveQuizEdit((rounds) => rounds.slice(0, 2));

      // Round 3 is gone, so Alpha is redrawn from what is left and not started.
      expect(await adminJokers(game)).toEqual({
        Alpha: [2, 'Round 2', 'drawn'],
        Bravo: [2, 'Round 2', 'chosen'],
      });
      const stored = await storedJokers(game);
      expect(stored[alpha.teamId].source).toBe('drawn');
      expect(syncsTo(game, alpha)).toEqual([{ joker: stored[alpha.teamId] }]);
      expect(syncsTo(game, bravo)).toEqual([]);
    });

    it('redraws the joker of a round deleted from the middle', async () => {
      const game = await jokerNight({ jokerRandom: () => 0.99 });
      await openPick(game);
      const [alpha, bravo] = game.teams;
      await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[1].id,
      });
      await game.gateway.handlePickJoker(asSocket(bravo.socket), {
        roundId: game.rounds[2].id,
      });
      await game.act('ADVANCE');
      game.clearEmits();

      await game.saveQuizEdit((rounds) => [rounds[0], rounds[2]]);

      // Alpha's Round 2 is gone; Bravo's Round 3 is now the second round.
      expect(await adminJokers(game)).toEqual({
        Alpha: [2, 'Round 3', 'drawn'],
        Bravo: [2, 'Round 3', 'chosen'],
      });
      expect(syncsTo(game, alpha)).toHaveLength(1);
    });

    it('keeps a joker on its round when the rounds are reordered', async () => {
      const game = await jokerNight();
      await openPick(game);
      const [alpha] = game.teams;
      await game.gateway.handlePickJoker(asSocket(alpha.socket), {
        roundId: game.rounds[1].id,
      });
      await game.act('ADVANCE');
      game.clearEmits();

      await game.saveQuizEdit((rounds) => [rounds[0], rounds[2], rounds[1]]);

      expect((await adminJokers(game)).Alpha).toEqual([3, 'Round 2', 'chosen']);
      expect(syncsTo(game, alpha)).toHaveLength(1);
    });

    describe('when the joker round’s questions are split across rounds', () => {
      const questionsOf = (round: number, count: number) =>
        Array.from({ length: count }, (_, index) => ({
          type: 'multiple_choice' as const,
          prompt: `Q${round}.${index + 1}?`,
          answer: 'right',
          points: 1,
          payload: { options: ['right', 'wrong'] },
        }));
      const SPLIT_ROUNDS: QuizRoundSpec[] = [3, 1, 1].map((count, index) => ({
        title: `Round ${index + 1}`,
        breakAfter: true,
        questions: questionsOf(index + 1, count),
      }));

      /** Alpha holds round 1 (Q1.1-Q1.3); the edit hands each round the questions of `layout` (by prompt), and Alpha's joker lands on the round it reads. */
      async function jokerAfterSplit(layout: string[][]) {
        const game = await jokerNight({ rounds: SPLIT_ROUNDS });
        await openPick(game);
        const [alpha] = game.teams;
        await game.gateway.handlePickJoker(asSocket(alpha.socket), {
          roundId: game.rounds[0].id,
        });
        await game.act('ADVANCE');
        game.clearEmits();

        await game.saveQuizEdit((rounds) => {
          const all = rounds.flatMap((round) => round.questions);
          return rounds.map((round, index) => ({
            ...round,
            questions: layout[index].map(
              (prompt) => all.find((question) => question.prompt === prompt)!,
            ),
          }));
        });

        return (await adminJokers(game)).Alpha;
      }

      it('follows the first of the rounds that keep the same number of them', async () => {
        expect(
          await jokerAfterSplit([
            ['Q2.1?', 'Q3.1?', 'Q1.3?'],
            ['Q1.1?'],
            ['Q1.2?'],
          ]),
        ).toEqual([1, 'Round 1', 'chosen']);
      });

      it('follows the round keeping most, not a later one keeping fewer', async () => {
        expect(
          await jokerAfterSplit([
            ['Q2.1?'],
            ['Q1.1?', 'Q1.2?'],
            ['Q1.3?', 'Q3.1?'],
          ]),
        ).toEqual([2, 'Round 2', 'chosen']);
      });

      it('follows a later round keeping more than an earlier one', async () => {
        expect(
          await jokerAfterSplit([
            ['Q2.1?'],
            ['Q1.1?'],
            ['Q1.2?', 'Q1.3?', 'Q3.1?'],
          ]),
        ).toEqual([3, 'Round 3', 'chosen']);
      });
    });

    it('leaves jokers alone when the edit does not touch the rounds', async () => {
      const game = await jokerNight({ jokerRandom: () => 0 });
      await pastThePick(game);
      const before = await storedJokers(game);
      game.clearEmits();

      await game.saveQuizEdit((rounds) => rounds);

      expect(await storedJokers(game)).toEqual(before);
      expect(
        game
          .roomEmits()
          .filter((emit) => emit.event === SOCKET_EVENTS.TEAM_JOKER_SYNCED),
      ).toEqual([]);
    });
  });
});
