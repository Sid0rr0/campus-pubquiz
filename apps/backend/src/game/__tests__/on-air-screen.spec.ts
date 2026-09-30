import {
  SOCKET_ROOMS,
  type DisplayStatePayload,
  type GameAction,
  type OnAirScreen,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('Screen projection — the named on-air screen', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  function displayView(): DisplayStatePayload {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
  }

  /** Runs each action and returns the screen on air after it. */
  async function screensAfter(
    actions: GameAction[],
  ): Promise<{ screen: OnAirScreen; screenKey: string }[]> {
    const seen: { screen: OnAirScreen; screenKey: string }[] = [];
    for (const action of actions) {
      await game.act(action);
      const { onAirScreen, screenKey } = displayView();
      seen.push({ screen: onAirScreen, screenKey });
    }
    return seen;
  }

  describe('a normal block, walked forward and back through break and reveal', () => {
    beforeEach(async () => {
      game = await harness.createGateway();
    });

    it('names each screen and the question or round it is about', async () => {
      const ids = game.rounds[0].questionIds;

      const seen = await screensAfter([
        'START_QUIZ',
        'ADVANCE', // round_intro
        'ADVANCE', // q1
        'ADVANCE', // q2
        'ADVANCE', // q3
        'ADVANCE', // q4
        'ADVANCE', // q5
        'ADVANCE', // locking
        'ADVANCE', // break_intro
        'ADVANCE', // reveal_intro
        'ADVANCE', // reveal q1
        'ADVANCE', // reveal q2
      ]);

      expect(seen.map(({ screen }) => screen)).toEqual([
        { kind: 'rules' },
        { kind: 'round_title', roundIndex: 0 },
        {
          kind: 'question',
          roundIndex: 0,
          questionIndex: 0,
          questionId: ids[0],
        },
        {
          kind: 'question',
          roundIndex: 0,
          questionIndex: 1,
          questionId: ids[1],
        },
        {
          kind: 'question',
          roundIndex: 0,
          questionIndex: 2,
          questionId: ids[2],
        },
        {
          kind: 'question',
          roundIndex: 0,
          questionIndex: 3,
          questionId: ids[3],
        },
        {
          kind: 'question',
          roundIndex: 0,
          questionIndex: 4,
          questionId: ids[4],
        },
        {
          kind: 'locking',
          roundIndex: 0,
          questionIndex: 4,
          questionId: ids[4],
        },
        { kind: 'break_intro', roundIndex: 0 },
        { kind: 'reveal_intro', roundIndex: 0, questionId: ids[0] },
        { kind: 'reveal', roundIndex: 0, questionId: ids[0] },
        { kind: 'reveal', roundIndex: 0, questionId: ids[1] },
      ]);
    });

    it('gives each distinct screen its own transition key', async () => {
      const seen = await screensAfter([
        'START_QUIZ',
        'ADVANCE', // round_intro
        'ADVANCE', // q1
        'ADVANCE', // q2
        'ADVANCE', // q3
        'ADVANCE', // q4
        'ADVANCE', // q5
        'ADVANCE', // locking
        'ADVANCE', // break_intro
        'ADVANCE', // reveal_intro
        'ADVANCE', // reveal q1
        'ADVANCE', // reveal q2
      ]);

      expect(seen.map(({ screenKey }) => screenKey)).toEqual([
        'rules',
        'round_intro-0',
        'question_open-0-0',
        'question_open-0-1',
        'question_open-0-2',
        'question_open-0-3',
        'question_open-0-4',
        'locking-0-4',
        'break_intro-0',
        'reveal_intro-1-1',
        'reveal-1-1-0',
        'reveal-1-2-0',
      ]);
    });

    it('keeps the screen key stable across broadcasts that change nothing on screen', async () => {
      await screensAfter(['START_QUIZ', 'ADVANCE', 'ADVANCE']);
      const before = displayView().screenKey;

      await game.act('TOGGLE_MEDIA_FULLSCREEN');

      expect(displayView().screenKey).toBe(before);
    });

    it('labels the header after the round of the question on screen, in question and reveal', async () => {
      await screensAfter(['START_QUIZ', 'ADVANCE', 'ADVANCE']);
      expect(displayView().header).toEqual({
        label: 'ROUND 1',
        title: 'Round 1',
        badge: 'QUESTION 1',
      });

      await screensAfter([
        'ADVANCE', // q2
        'ADVANCE', // q3
        'ADVANCE', // q4
        'ADVANCE', // q5
        'ADVANCE', // locking
        'ADVANCE', // break_intro
        'ADVANCE', // reveal_intro
        'ADVANCE', // reveal q1
        'ADVANCE', // reveal q2
      ]);
      expect(displayView().header).toEqual({
        label: 'ROUND 1',
        title: 'Round 1',
        badge: 'REVEALING ANSWERS · QUESTION 2',
      });
    });

    it("follows Previous back from reveal into the break review of the block's last question", async () => {
      const ids = game.rounds[0].questionIds;
      await screensAfter([
        'START_QUIZ',
        'ADVANCE', // round_intro
        'ADVANCE', // q1
        'ADVANCE', // q2
        'ADVANCE', // q3
        'ADVANCE', // q4
        'ADVANCE', // q5
        'ADVANCE', // locking
        'ADVANCE', // break_intro
        'ADVANCE', // reveal_intro
        'ADVANCE', // reveal q1
      ]);

      const seen = await screensAfter(['PREVIOUS', 'PREVIOUS']);

      expect(seen.map(({ screen }) => screen.kind)).toEqual([
        'reveal_intro',
        'break_review',
      ]);
      expect(seen[1].screen).toEqual({
        kind: 'break_review',
        questionId: ids[4],
      });
      expect(seen[1].screenKey).toBe(
        `break-${displayView().progress.roundIndex}-${displayView().progress.revealIndex}`,
      );
      expect(displayView().header).toEqual({
        label: 'ROUND 1',
        title: 'Round 1',
        badge: 'QUESTION 5 (BREAK)',
      });
    });

    it('puts the named screen in the admin view too, and not in the players view', async () => {
      await screensAfter(['START_QUIZ', 'ADVANCE']);

      const admin = game.gameState.getView(game.joinCode, SOCKET_ROOMS.ADMIN);
      const players = game.gameState.getView(
        game.joinCode,
        SOCKET_ROOMS.PLAYERS,
      );

      expect(admin.onAirScreen).toEqual({ kind: 'round_title', roundIndex: 0 });
      expect(players).not.toHaveProperty('onAirScreen');
    });
  });

  describe('a kahoot round', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ kahootMode: true });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // round_intro
      await game.act('ADVANCE'); // q1
    });

    it('is not between questions while a question is simply open', () => {
      expect(displayView().isBetweenKahootQuestions).toBe(false);
    });

    it('shows the leaderboard over the next, already-open question and flags it as between kahoot questions', async () => {
      await game.act('ADVANCE'); // locking
      await game.act('ADVANCE'); // reveal
      await game.act('ADVANCE'); // q2 behind the leaderboard

      const view = displayView();

      expect(view.progress.status).toBe('question_open');
      expect(view.onAirScreen).toEqual({ kind: 'leaderboard' });
      expect(view.screenKey).toBe('leaderboard');
      expect(view.isBetweenKahootQuestions).toBe(true);
    });

    it('brings the question on air and clears the flag once the leaderboard is dismissed', async () => {
      await game.act('ADVANCE'); // locking
      await game.act('ADVANCE'); // reveal
      await game.act('ADVANCE'); // q2 behind the leaderboard

      await game.act('TOGGLE_LEADERBOARD');

      const view = displayView();
      expect(view.onAirScreen).toMatchObject({
        kind: 'question',
        questionIndex: 1,
      });
      expect(view.isBetweenKahootQuestions).toBe(false);
    });

    it('is not between questions when the leaderboard is shown over a reveal', async () => {
      await game.act('ADVANCE'); // locking
      await game.act('ADVANCE'); // reveal

      await game.act('TOGGLE_LEADERBOARD');

      expect(displayView().isBetweenKahootQuestions).toBe(false);
    });
  });

  describe('a closest_guess reveal', () => {
    const rounds: QuizRoundSpec[] = [
      {
        title: 'Round 1',
        breakAfter: true,
        questions: [
          {
            type: 'closest_guess',
            prompt: 'How many students attend this university?',
            points: 5,
            answer: '1000',
          },
          {
            type: 'free_text',
            prompt: 'Name a fruit',
            points: 1,
            answer: 'Apple',
          },
        ],
      },
    ];

    it('changes the screen key with every reveal sub-step while the named screen stays on the same question', async () => {
      game = await harness.createGateway({
        rounds,
        teamNames: ['Team A', 'Team B'],
      });
      await game.act('START_QUIZ');
      await game.act('ADVANCE'); // round_intro
      await game.act('ADVANCE'); // closest_guess question
      for (const [index, value] of ['900', '950'].entries()) {
        const { socket, teamId } = game.teams[index];
        await game.gateway.handleSubmitAnswer(asSocket(socket), {
          questionId: game.rounds[0].questionIds[0],
          teamId,
          value,
        });
      }

      const seen = await screensAfter([
        'ADVANCE', // q2
        'ADVANCE', // locking
        'ADVANCE', // break_intro
        'ADVANCE', // reveal_intro
        'ADVANCE', // reveal, step 0
        'ADVANCE', // step 1
        'ADVANCE', // step 2
        'ADVANCE', // step 3
        'ADVANCE', // step 4
        'ADVANCE', // next question
      ]);

      const closestGuessId = game.rounds[0].questionIds[0];
      const revealSteps = seen.slice(4, 9);
      expect(revealSteps.map(({ screen }) => screen)).toEqual(
        Array(5).fill({
          kind: 'reveal',
          roundIndex: 0,
          questionId: closestGuessId,
        }),
      );
      expect(revealSteps.map(({ screenKey }) => screenKey)).toEqual([
        'reveal-1-1-0',
        'reveal-1-1-1',
        'reveal-1-1-2',
        'reveal-1-1-3',
        'reveal-1-1-4',
      ]);
      expect(seen[9].screenKey).toBe('reveal-1-2-0');
    });
  });

  describe('a showdown after the quiz ends', () => {
    beforeEach(async () => {
      game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
      await tieOnFirstQuestion(game, game.teams);
      await game.act('END_QUIZ');
    });

    it('names the ended screen until a showdown round exists', () => {
      expect(displayView().onAirScreen).toEqual({ kind: 'ended' });
      expect(displayView().screenKey).toBe('ended');
    });

    it('names the showdown screen, keyed by round and reveal step', async () => {
      const admin = await game.connectAdmin();
      await game.gateway.handleCreateShowdownRound(asSocket(admin), {
        question: 'How many people are in this room?',
        answer: '42',
        points: 5,
      });

      const view = displayView();

      expect(view.onAirScreen).toEqual({
        kind: 'showdown',
        showdownId: view.activeShowdown!.id,
      });
      expect(view.screenKey).toBe(
        `ended-showdown-${view.activeShowdown!.id}-${view.showdownRevealStep}`,
      );
    });
  });
});
