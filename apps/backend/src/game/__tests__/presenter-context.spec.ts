import { RequestContext } from '@mikro-orm/postgresql';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  HEADING_BY_SCREEN,
  createAnswerer,
  createPreviewWalk,
  summarise,
  type PressResult,
} from '@/game/__tests__/walk-test-utils';
import {
  TWO_ROUND_QUIZ,
  TWO_ROUND_QUIZ_HOST_NOTE,
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const TWO_BLOCK_QUIZ: QuizRoundSpec[] = [
  {
    title: 'Music',
    breakAfter: true,
    questions: [
      { type: 'free_text', prompt: 'Band?', answer: 'ABBA', points: 1 },
    ],
  },
  {
    title: 'Sport',
    breakAfter: true,
    questions: [
      { type: 'free_text', prompt: 'Sport?', answer: 'Golf', points: 1 },
    ],
  },
];

describe('GameStateService — getPresenterContext', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function advance(times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await game.act('ADVANCE');
    }
  }

  /** Has the team answer the first question correctly, so it is on the board for the leaderboard screens. */
  async function answerFirstQuestion(answer: string): Promise<void> {
    const { socket, teamId } = game.teams[0];
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: game.rounds[0].questionIds[0],
      teamId,
      value: answer,
    });
  }

  function screens() {
    const { currentScreen, nextScreen } = game.gameState.getPresenterContext(
      game.joinCode,
    );
    return {
      current: currentScreen.heading,
      next: nextScreen?.heading ?? null,
      nextBody: nextScreen?.body,
      nextQuestionId: nextScreen?.question?.id,
    };
  }

  describe('two-round, one-block quiz', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: TWO_ROUND_QUIZ,
        teamNames: ['The Quizzards'],
      });
    });

    it('previews the rules screen from the lobby', () => {
      expect(screens()).toMatchObject({ current: 'Lobby', next: 'Rules' });
    });

    it('returns notes for the open question and previews the next question with its answer', async () => {
      await game.act('START_QUIZ');
      await advance(2); // -> round_intro(0) -> r1q1

      const context = game.gameState.getPresenterContext(game.joinCode);
      expect(context.currentQuestionNotes).toBe(TWO_ROUND_QUIZ_HOST_NOTE);
      expect(context.currentScreen.heading).toBe('R1 Q1');
      expect(context.nextScreen?.question).toEqual(
        expect.objectContaining({
          id: game.rounds[0].questionIds[1],
          answer: 'Jupiter',
        }),
      );
    });

    it('walks every screen up to the break', async () => {
      await game.act('START_QUIZ');
      expect(screens()).toMatchObject({
        current: 'Rules',
        next: 'Round 1 title',
        nextBody: 'General Knowledge',
      });

      await advance(1);
      expect(screens()).toMatchObject({
        current: 'Round 1 title',
        next: 'R1 Q1',
        nextQuestionId: game.rounds[0].questionIds[0],
      });

      await advance(2); // -> r1q2, last question of a non-break round
      expect(screens()).toMatchObject({
        current: 'R1 Q2',
        next: 'Round 2 title',
        nextBody: 'Landmarks & Flags',
      });

      await advance(2); // -> round_intro(1) -> r2q1
      expect(screens()).toMatchObject({
        next: 'R2 Q2',
        nextQuestionId: game.rounds[1].questionIds[1],
      });

      await advance(1); // -> r2q2, last question before the break
      expect(screens()).toMatchObject({ next: 'Locking answers' });

      await advance(1); // -> locking
      expect(screens()).toMatchObject({
        current: 'Locking answers',
        next: 'Break 1',
        nextBody: 'After round 2',
      });
    });

    it('walks from the break through every reveal to the final leaderboard', async () => {
      await game.act('START_QUIZ');
      await advance(2); // -> round_intro(0) -> r1q1
      await answerFirstQuestion('Paris');
      await advance(6); // -> break_intro

      expect(screens()).toMatchObject({
        current: 'Break 1',
        next: 'Revealing · Round 1 title',
        nextBody: 'General Knowledge',
      });

      await advance(1); // -> reveal_intro(0)
      expect(screens()).toMatchObject({
        next: 'Revealing R1 Q1',
        nextBody: 'Capital of France? — Answer: Paris',
      });

      await advance(1); // -> reveal R1 Q1
      expect(screens()).toMatchObject({
        current: 'Revealing R1 Q1',
        next: 'Revealing R1 Q2',
      });

      await advance(1); // -> reveal R1 Q2, last of round 1
      expect(screens()).toMatchObject({
        next: 'Revealing · Round 2 title',
        nextBody: 'Landmarks & Flags',
      });

      await advance(3); // -> reveal_intro(2) -> R2 Q1 -> R2 Q2
      expect(screens()).toMatchObject({
        current: 'Revealing R2 Q2',
        next: 'Leaderboard',
        nextBody: 'Final standings',
      });

      await advance(1); // -> ended, final leaderboard
      expect(screens()).toMatchObject({
        current: 'Leaderboard',
        next: 'Leaderboard',
        nextBody: 'Next place (1 of 1)',
      });

      await game.act('ADVANCE');
      // Every rank is shown and nothing waits under the final board, so
      // Advance does nothing and the preview names no next screen.
      expect(screens()).toMatchObject({ next: null });
    });
  });

  describe('agreement with /display across a whole-quiz walk', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: TWO_ROUND_QUIZ,
        teamNames: ['The Quizzards'],
      });
    });

    it('describes exactly the screen /display has on air, and previews exactly the screen the next Advance puts there', async () => {
      await game.act('START_QUIZ');
      // Past the final reveal the leaderboard takes over and ADVANCE is no
      // longer the control, so the walk stops at the last reveal.
      for (let step = 0; step < 14; step += 1) {
        const before = game.gameState.getPresenterContext(game.joinCode);
        await game.act('ADVANCE');
        const after = game.gameState.getPresenterContext(game.joinCode);
        const { onAirScreen } = game.gameState.getView(
          game.joinCode,
          SOCKET_ROOMS.ADMIN,
        );

        expect(after.currentScreen.heading).toMatch(
          HEADING_BY_SCREEN[onAirScreen.kind],
        );
        expect(before.nextScreen?.heading).toBe(after.currentScreen.heading);
      }
    });
  });

  describe('two-block quiz', () => {
    beforeEach(async () => {
      game = await harness.createGateway({
        rounds: TWO_BLOCK_QUIZ,
        teamNames: ['The Quizzards'],
      });
    });

    it("previews the leaderboard after a block's last reveal, then the next round's title once every team is shown", async () => {
      await game.act('START_QUIZ');
      await advance(2); // round_intro, q1
      await answerFirstQuestion('ABBA');
      await advance(4); // locking, break_intro, reveal_intro, reveal

      expect(screens()).toMatchObject({
        current: 'Revealing R1 Q1',
        next: 'Leaderboard',
        nextBody: undefined,
      });

      await advance(1); // -> leaderboard over round_intro(1)
      expect(screens()).toMatchObject({
        current: 'Leaderboard',
        nextBody: 'Next place (1 of 1)',
      });

      await game.act('ADVANCE');
      expect(screens()).toMatchObject({
        next: 'Round 2 title',
        nextBody: 'Sport',
      });
    });
  });
  describe('the preview agrees with the real press across whole quizzes', () => {
    /** Names a mismatch by what was on air and what the preview claimed. */
    function nameDisagreement({
      outcome,
      before,
    }: Omit<PressResult, 'disagreement'>): string {
      return `${outcome} from "${before.currentHeading}" previewed "${before.next?.heading ?? null}" (${before.next?.body ?? '-'})`;
    }

    function previewWalk() {
      return createPreviewWalk(game, nameDisagreement);
    }

    const TWO_BLOCK_WALK_QUIZ: QuizRoundSpec[] = [
      {
        title: 'Music',
        breakAfter: true,
        questions: [
          { type: 'free_text', prompt: 'Band?', answer: 'ABBA', points: 1 },
          { type: 'free_text', prompt: 'Song?', answer: 'Waterloo', points: 1 },
        ],
      },
      {
        title: 'Sport',
        breakAfter: true,
        questions: [
          { type: 'free_text', prompt: 'Sport?', answer: 'Golf', points: 1 },
        ],
      },
    ];

    it('agrees through the lobby start, a two-block quiz, its breaks, reveals and boards', async () => {
      game = await harness.createGateway({
        rounds: TWO_BLOCK_WALK_QUIZ,
        teamNames: ['Team A', 'Team B'],
      });
      const answer = createAnswerer(game, TWO_BLOCK_WALK_QUIZ, (t) => t === 0);

      const { presses, disagreements } = await previewWalk().walk(answer);

      expect(presses[0].before.status).toBe('lobby');
      expect(presses.at(-1)?.after.status).toBe('ended');
      expect(new Set(presses.map(({ after }) => after.kind))).toEqual(
        new Set([
          'rules',
          'round_title',
          'question',
          'locking',
          'break_intro',
          'reveal_intro',
          'reveal',
          'leaderboard',
        ]),
      );
      expect(disagreements).toEqual([]);
    });

    it('agrees when a leaderboard has a tie', async () => {
      game = await harness.createGateway({
        rounds: TWO_BLOCK_WALK_QUIZ,
        teamNames: ['Team A', 'Team B'],
      });
      const answer = createAnswerer(game, TWO_BLOCK_WALK_QUIZ, () => true);

      const result = await previewWalk().walk(answer);

      expect(
        result.presses.some(({ after }) => after.kind === 'leaderboard'),
      ).toBe(true);
      expect(result.disagreements).toEqual([]);
    });

    const MAX_PRESSES_TO_BREAK = 30;

    function isBoardUp(): boolean {
      return game.gameState.getSnapshot(game.joinCode).progress
        .isLeaderboardVisible;
    }

    describe('a break with an ungraded answer', () => {
      const AUDIO_QUIZ: QuizRoundSpec[] = [
        {
          title: 'Music',
          breakAfter: true,
          questions: [
            {
              type: 'audio',
              prompt: 'Name that tune',
              answer: 'Queen',
              points: 1,
            },
          ],
        },
      ];
      let admin: Awaited<ReturnType<RealStoreGateway['connectAdmin']>>;

      async function submit(value: string) {
        const { socket, teamId } = game.teams[0];
        await game.gateway.handleSubmitAnswer(asSocket(socket), {
          questionId: game.rounds[0].questionIds[0],
          teamId,
          value,
        });
      }

      async function gradeFirstAnswer() {
        const [answer] = await game.inRequestContext(() =>
          game.answerService.listForQuestion(
            game.gameSessionId,
            game.rounds[0].questionIds[0],
          ),
        );
        await game.gateway.handleGradeAnswer(asSocket(admin), {
          answerId: answer.answerId,
          pointsAwarded: 1,
        });
      }

      async function fixAnswerKey(answer: string) {
        const questionId = game.rounds[0].questionIds[0];
        await game.inRequestContext(async () => {
          const em = RequestContext.getEntityManager()!;
          const question = await em.findOneOrFail(Question, { id: questionId });
          question.answer = answer;
          await em.flush();
        });
        await game.inRequestContext(() =>
          game.gateway.notifyQuizEdited(game.joinCode, [questionId]),
        );
      }

      /** Presses until the quiz sits in the break, submitting `value` once the question is open. */
      async function pressToBreak(
        walk: ReturnType<typeof previewWalk>,
        value: string,
      ) {
        const presses: PressResult[] = [];
        let hasSubmitted = false;
        for (let step = 0; step < MAX_PRESSES_TO_BREAK; step += 1) {
          const { status } = game.gameState.getSnapshot(game.joinCode).progress;
          if (status === 'break_intro') return presses;
          if (status === 'question_open' && !hasSubmitted) {
            await submit(value);
            hasSubmitted = true;
          }
          presses.push(
            await walk.pressAndCompare(
              status === 'lobby' ? 'START_QUIZ' : 'ADVANCE',
            ),
          );
        }
        throw new Error('the quiz never reached the break');
      }

      beforeEach(async () => {
        game = await harness.createGateway({
          rounds: AUDIO_QUIZ,
          teamNames: ['The Quizzards'],
        });
        admin = await game.connectAdmin();
      });

      it('is refused while the answer waits, then advances once the moderator has graded it', async () => {
        const walk = previewWalk();
        const toBreak = await pressToBreak(walk, 'Abba');

        const refused = await walk.pressAndCompare();
        await gradeFirstAnswer();
        expect(walk.observe().next?.heading).toMatch(
          HEADING_BY_SCREEN.reveal_intro,
        );
        const rest = await walk.walk();

        expect(refused.outcome).toBe('refused');
        expect(refused.before.next).toMatchObject({
          body: 'Waiting for grading',
        });
        expect(
          summarise([...toBreak, refused, ...rest.presses]).disagreements,
        ).toEqual([]);
      });

      it('is refused after a live key fix leaves a matched answer ungraded, then advances once it is graded', async () => {
        const walk = previewWalk();
        const toBreak = await pressToBreak(walk, 'Queen');
        await fixAnswerKey('Queen II');

        const refused = await walk.pressAndCompare();
        await gradeFirstAnswer();
        expect(walk.observe().next?.heading).toMatch(
          HEADING_BY_SCREEN.reveal_intro,
        );
        const rest = await walk.walk();

        expect(refused.outcome).toBe('refused');
        expect(refused.before.next).toMatchObject({
          body: 'Waiting for grading',
        });
        expect(
          summarise([...toBreak, refused, ...rest.presses]).disagreements,
        ).toEqual([]);
      });
    });

    describe('a closest_guess reveal', () => {
      const CLOSEST_WALK_QUIZ: QuizRoundSpec[] = [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            {
              type: 'free_text',
              prompt: 'Name a fruit',
              answer: 'Apple',
              points: 1,
            },
            {
              type: 'closest_guess',
              prompt: 'How many students attend this university?',
              answer: '1000',
              points: 5,
            },
          ],
        },
      ];

      it('agrees through its sub-steps, with the leaderboard shown and hidden mid-reveal', async () => {
        game = await harness.createGateway({
          rounds: CLOSEST_WALK_QUIZ,
          teamNames: ['Team A', 'Team B', 'Team C'],
        });
        const answer = createAnswerer(game, CLOSEST_WALK_QUIZ, (t) => t === 0);
        let phase: 'before_board' | 'board_up' | 'done' = 'before_board';

        const result = await previewWalk().walk(async ({ status }) => {
          await answer();
          const {
            closestGuessRevealStep: step,
            progress,
            leaderboardRevealCount,
          } = game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
          if (status !== 'reveal') return;
          if (
            phase === 'before_board' &&
            step > 0 &&
            !progress.isLeaderboardVisible
          ) {
            await game.act('TOGGLE_LEADERBOARD');
            phase = 'board_up';
          } else if (
            phase === 'board_up' &&
            progress.isLeaderboardVisible &&
            leaderboardRevealCount > 0
          ) {
            await game.act('TOGGLE_LEADERBOARD');
            phase = 'done';
          }
        });

        expect(phase).toBe('done');
        expect(result.disagreements).toEqual([]);
      });
    });

    describe('a kahoot round', () => {
      const KAHOOT_TEAMS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
      const KAHOOT_QUIZ: QuizRoundSpec[] = [
        {
          title: 'Kahoot',
          breakAfter: true,
          kahootMode: true,
          questions: ['A', 'B', 'C', 'D', 'E'].map((answer) => ({
            type: 'free_text' as const,
            prompt: `Say ${answer}`,
            answer,
            points: 1,
          })),
        },
      ];

      it('agrees through the between-questions board and the round-end board with its top-5 cutoff', async () => {
        game = await harness.createGateway({
          rounds: KAHOOT_QUIZ,
          teamNames: KAHOOT_TEAMS,
        });
        const answer = createAnswerer(
          game,
          KAHOOT_QUIZ,
          (team, question) => question < team,
        );

        const result = await previewWalk().walk(answer);

        const boards = result.presses.filter(
          ({ before }) => before.kind === 'leaderboard',
        );
        expect(boards.length).toBeGreaterThan(5);
        expect(result.disagreements).toEqual([]);
      });
    });

    describe('an ended quiz with an active showdown', () => {
      async function guess(teamIndex: number, value: string) {
        const { socket, teamId } = game.teams[teamIndex];
        const { activeShowdown } = game.gameState.getSnapshot(game.joinCode);
        await game.gateway.handleSubmitShowdownGuess(asSocket(socket), {
          showdownRoundId: activeShowdown!.id,
          teamId,
          value,
        });
      }

      it('agrees while waiting for every guess and through the final resolving step', async () => {
        game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
        await tieOnFirstQuestion(game, game.teams);
        await game.act('END_QUIZ');
        const admin = await game.connectAdmin();
        await game.gateway.handleCreateShowdownRound(asSocket(admin), {
          question: 'How many people are in this room?',
          answer: '42',
          points: 5,
        });
        const walk = previewWalk();
        const cleared: PressResult[] = [];
        for (let step = 0; step < MAX_PRESSES_TO_BREAK; step += 1) {
          if (!isBoardUp()) break;
          cleared.push(await walk.pressAndCompare());
        }
        expect(isBoardUp()).toBe(false);
        await guess(0, '40');
        const waiting = await walk.pressAndCompare();
        await guess(1, '50');

        const rest = await walk.walk();

        expect(waiting.outcome).toBe('refused');
        expect(waiting.before.next?.body).toBe('Waiting for every guess');
        expect(rest.presses.at(-1)?.outcome).toBe('unmoved');
        expect(
          summarise([...cleared, waiting, ...rest.presses]).disagreements,
        ).toEqual([]);
      });
    });
  });
});
