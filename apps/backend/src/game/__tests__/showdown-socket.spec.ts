import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type GameAction,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const NO_LONGER_ACCEPTING =
  'This showdown round is no longer accepting guesses';

const SHOWDOWN_PAYLOAD = {
  question: 'How many?',
  answer: '100',
  points: 5,
};

describe('GameGateway — showdown', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  /** The state the display room was last sent. */
  function lastDisplayState(): StateSnapshotPayload | undefined {
    return game
      .payloadsTo<StateSnapshotPayload>(
        SOCKET_ROOMS.DISPLAY,
        SOCKET_EVENTS.STATE_UPDATED,
      )
      .at(-1);
  }

  describe('CREATE_SHOWDOWN_ROUND', () => {
    it('rejects when nobody is tied for first', async () => {
      game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
      // Only Team A answers, so it leads alone.
      await tieOnFirstQuestion(game, [game.teams[0]]);
      const admin = await game.connectAdmin();
      game.clearEmits();

      await expect(
        game.gateway.handleCreateShowdownRound(
          asSocket(admin),
          SHOWDOWN_PAYLOAD,
        ),
      ).resolves.toEqual({
        success: false,
        error: 'No tie for first place to break',
      });

      expect(game.roomEmits()).toEqual([]);
      expect((await game.snapshot()).activeShowdown).toBeNull();
    });

    it('rejects CREATE_SHOWDOWN_ROUND from a non-admin client', async () => {
      game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
      await tieOnFirstQuestion(game, game.teams);
      const player = await game.connectPlayer();
      game.clearEmits();

      await expect(
        game.gateway.handleCreateShowdownRound(
          asSocket(player),
          SHOWDOWN_PAYLOAD,
        ),
      ).resolves.toMatchObject({ success: false });

      expect(game.roomEmits()).toEqual([]);
      expect((await game.snapshot()).activeShowdown).toBeNull();
    });

    it('creates a round for the tied teams without touching leaderboard visibility, and broadcasts activeShowdown', async () => {
      game = await harness.createGateway({
        teamNames: ['Team A', 'Team B', 'Team C'],
      });
      const [teamA, teamB] = game.teams;
      await tieOnFirstQuestion(game, [teamA, teamB]);
      // The final standings are still up (e.g. auto-shown when the quiz hit
      // 'ended') — creating the round must not yank them away.
      await game.act('TOGGLE_LEADERBOARD');
      const admin = await game.connectAdmin();
      game.clearEmits();

      await game.gateway.handleCreateShowdownRound(
        asSocket(admin),
        SHOWDOWN_PAYLOAD,
      );

      // Only the tied teams are seated, in leaderboard order.
      const state = lastDisplayState();
      expect(state?.showdownRevealStep).toBe(0);
      expect(state?.activeShowdown).toMatchObject({
        question: 'How many?',
        participants: [
          { teamId: teamA.teamId, teamName: 'Team A', seatIndex: 0 },
          { teamId: teamB.teamId, teamName: 'Team B', seatIndex: 1 },
        ],
      });
      expect(state?.progress.isLeaderboardVisible).toBe(true);
    });
  });

  describe('SUBMIT_SHOWDOWN_GUESS', () => {
    async function seedActiveRound(): Promise<number> {
      game = await harness.createGateway({
        teamNames: ['Team A', 'Team B', 'Team C'],
      });
      await tieOnFirstQuestion(game, game.teams.slice(0, 2));
      const admin = await game.connectAdmin();
      await game.gateway.handleCreateShowdownRound(
        asSocket(admin),
        SHOWDOWN_PAYLOAD,
      );
      const { activeShowdown } = await game.snapshot();
      game.clearEmits();
      return activeShowdown!.id;
    }

    async function expectNoGuessRecorded(): Promise<void> {
      expect(game.roomEmits()).toEqual([]);
      const { activeShowdown } = await game.snapshot();
      expect(activeShowdown?.participants.map((p) => p.hasGuessed)).toEqual([
        false,
        false,
      ]);
    }

    it('accepts a guess from the owning team and broadcasts hasGuessed without the value', async () => {
      const showdownRoundId = await seedActiveRound();
      const [teamA, teamB] = game.teams;

      await game.gateway.handleSubmitShowdownGuess(asSocket(teamA.socket), {
        showdownRoundId,
        teamId: teamA.teamId,
        value: '95',
      });

      const state = lastDisplayState();
      const broadcastParticipants = state?.activeShowdown?.participants;
      expect(broadcastParticipants).toEqual([
        {
          teamId: teamA.teamId,
          teamName: 'Team A',
          seatIndex: 0,
          hasGuessed: true,
        },
        {
          teamId: teamB.teamId,
          teamName: 'Team B',
          seatIndex: 1,
          hasGuessed: false,
        },
      ]);
      // Guess values are never included at step 0, however far the reveal
      // walk has progressed for other participants.
      expect(broadcastParticipants?.[0].guess).toBeUndefined();
    });

    it("rejects a guess for a team the submitting socket doesn't own", async () => {
      const showdownRoundId = await seedActiveRound();
      const attacker = await game.connectPlayer();

      await expect(
        game.gateway.handleSubmitShowdownGuess(asSocket(attacker), {
          showdownRoundId,
          teamId: game.teams[0].teamId,
          value: '95',
        }),
      ).resolves.toEqual({
        success: false,
        error: 'You may only submit guesses for your own team',
      });

      await expectNoGuessRecorded();
    });

    it('rejects a guess from a team not seated in the round', async () => {
      const showdownRoundId = await seedActiveRound();
      const outsider = game.teams[2];

      await expect(
        game.gateway.handleSubmitShowdownGuess(asSocket(outsider.socket), {
          showdownRoundId,
          teamId: outsider.teamId,
          value: '95',
        }),
      ).resolves.toEqual({
        success: false,
        error: 'Your team is not part of this showdown round',
      });

      await expectNoGuessRecorded();
    });

    it('rejects a guess once the reveal has moved past step 0', async () => {
      const showdownRoundId = await seedActiveRound();
      const [teamA, teamB] = game.teams;
      for (const [team, value] of [
        [teamA, '10'],
        [teamB, '20'],
      ] as const) {
        await game.gateway.handleSubmitShowdownGuess(asSocket(team.socket), {
          showdownRoundId,
          teamId: team.teamId,
          value,
        });
      }
      // The showdown-reveal intercept only engages once the quiz has
      // actually ended — reached here via the same END_QUIZ escape hatch the
      // admin's "End Quiz" button uses.
      await game.act('END_QUIZ');
      const stepped = await game.act('ADVANCE');
      expect(stepped.showdownRevealStep).toBe(1);
      game.clearEmits();

      await expect(
        game.gateway.handleSubmitShowdownGuess(asSocket(teamA.socket), {
          showdownRoundId,
          teamId: teamA.teamId,
          value: '95',
        }),
      ).resolves.toEqual({ success: false, error: NO_LONGER_ACCEPTING });

      expect(game.roomEmits()).toEqual([]);
      const { activeShowdown } = await game.snapshot();
      expect(activeShowdown?.participants[0].guess).toBe('10');
    });

    it('rejects a guess naming a stale round id', async () => {
      const showdownRoundId = await seedActiveRound();
      const [teamA] = game.teams;

      await expect(
        game.gateway.handleSubmitShowdownGuess(asSocket(teamA.socket), {
          showdownRoundId: showdownRoundId + 1000,
          teamId: teamA.teamId,
          value: '95',
        }),
      ).resolves.toEqual({ success: false, error: NO_LONGER_ACCEPTING });

      await expectNoGuessRecorded();
    });

    it('checks that guesses are accepted before it checks the seat', async () => {
      const showdownRoundId = await seedActiveRound();
      const attacker = await game.connectPlayer();

      await expect(
        game.gateway.handleSubmitShowdownGuess(asSocket(attacker), {
          showdownRoundId: showdownRoundId + 1000,
          teamId: game.teams[0].teamId,
          value: '95',
        }),
      ).resolves.toEqual({ success: false, error: NO_LONGER_ACCEPTING });
    });

    it('shows the guess form on the phone exactly while a guess is accepted, at every reveal step, resolved or not', async () => {
      const showdownRoundId = await seedActiveRound();
      const [teamA, teamB] = game.teams;
      for (const team of [teamA, teamB]) {
        await game.gateway.handleSubmitShowdownGuess(asSocket(team.socket), {
          showdownRoundId,
          teamId: team.teamId,
          value: '10',
        });
      }
      const ended = await game.act('END_QUIZ');
      // A phone shows the board over everything while the final standings
      // are up; hide them so it shows the showdown.
      if (ended.progress.isLeaderboardVisible) {
        await game.act('TOGGLE_LEADERBOARD');
      }

      async function isGuessAccepted(): Promise<boolean> {
        const result = await game.gateway.handleSubmitShowdownGuess(
          asSocket(teamA.socket),
          { showdownRoundId, teamId: teamA.teamId, value: '11' },
        );
        return result.success;
      }
      function phoneKind(): string {
        return game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS)
          .phoneScreen.kind;
      }

      // Forward past the final step (resolving the round), then all the way
      // back to step 0: a resolved round at step 0 accepts no guesses.
      const walk = [
        ...Array<GameAction>(3).fill('ADVANCE'),
        ...Array<GameAction>(4).fill('PREVIOUS'),
      ];
      const observed: [string, boolean][] = [
        [phoneKind(), await isGuessAccepted()],
      ];
      for (const action of walk) {
        await game.act(action);
        observed.push([phoneKind(), await isGuessAccepted()]);
      }

      for (const [kind, isAccepted] of observed) {
        expect(kind === 'showdown_guessing').toBe(isAccepted);
      }
      // The walk covers both outcomes, so the check above isn't vacuous.
      expect(observed.some(([, isAccepted]) => isAccepted)).toBe(true);
      expect(observed.some(([, isAccepted]) => !isAccepted)).toBe(true);
      expect(observed.at(-1)).toEqual(['showdown_reveal', false]);
    });

    it('rejects SUBMIT_SHOWDOWN_GUESS from a non-player client', async () => {
      const showdownRoundId = await seedActiveRound();
      const admin = await game.connectAdmin();

      await expect(
        game.gateway.handleSubmitShowdownGuess(asSocket(admin), {
          showdownRoundId,
          teamId: game.teams[0].teamId,
          value: '95',
        }),
      ).resolves.toMatchObject({ success: false });

      await expectNoGuessRecorded();
    });
  });
});
