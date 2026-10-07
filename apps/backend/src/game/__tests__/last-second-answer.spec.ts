import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const LOCKED = 'Answers are locked for this question';

const CLOSEST_GUESS_ROUND: QuizRoundSpec[] = [
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
    ],
  },
];

const KAHOOT_ROUND: QuizRoundSpec[] = [
  {
    title: 'Speed Round',
    kahootMode: true,
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      },
    ],
  },
];

interface LockedGame {
  game: RealStoreGateway;
  admin: MockSocket;
  questionId: number;
}

type Pressing = 'press' | 'lock timer';

describe('GameGateway — a last-second answer either counts or is refused', () => {
  const harness = setupRealStoreGatewayTest();

  /** Opens the block's only question; two teams are joined. */
  async function openQuestion(rounds: QuizRoundSpec[]): Promise<LockedGame> {
    const game = await harness.createGateway({
      rounds,
      teamNames: ['Early Bird', 'Last Second'],
    });
    const admin = await game.connectAdmin();
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action);
    }
    const [questionId] = game.rounds[0].questionIds;
    return { game, admin, questionId };
  }

  function submit(
    game: RealStoreGateway,
    index: number,
    questionId: number,
    value: string,
  ) {
    const { socket, teamId } = game.teams[index];
    return game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value,
    });
  }

  function storedAnswers(game: RealStoreGateway, questionId: number) {
    return game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
  }

  function lastAdminAnswerList(game: RealStoreGateway, questionId: number) {
    const lists = game
      .payloadsTo<{
        questionId: number;
        answers: { teamName: string; pointsAwarded: number | null }[];
      }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED)
      .filter((payload) => payload.questionId === questionId);
    return lists[lists.length - 1]?.answers ?? [];
  }

  /** Moves the block into the break, by the quiz master's Advance or by the lock timer running out. */
  function startPress(
    { game, admin }: LockedGame,
    pressing: Pressing,
  ): Promise<unknown> {
    return pressing === 'press'
      ? game.gateway.handleAdminAction(asSocket(admin), { action: 'ADVANCE' })
      : game.timers().lock.fireNow();
  }

  describe.each<Pressing>(['press', 'lock timer'])(
    'closest_guess on the last question, against the %s into the break',
    (pressing) => {
      async function toLocking() {
        const opened = await openQuestion(CLOSEST_GUESS_ROUND);
        await submit(opened.game, 0, opened.questionId, '900');
        await opened.game.act('ADVANCE'); // -> locking, lock armed
        opened.game.clearEmits();
        return opened;
      }

      it('refuses the answer and stores nothing when the press was queued first', async () => {
        const locked = await toLocking();
        const { game, questionId } = locked;
        const held = holdNextCall(game.progressRepository, 'save');
        const moving = startPress(locked, pressing);
        await held.started;

        const waiting = game.nextWriteWaiting();
        const submitting = submit(game, 1, questionId, '990');
        await waiting;
        held.release();
        const [, ack] = await Promise.all([moving, submitting]);

        expect(ack).toMatchObject({ success: false, error: LOCKED });
        const stored = await storedAnswers(game, questionId);
        expect(stored.map((answer) => answer.teamName)).toEqual(['Early Bird']);
        expect(
          lastAdminAnswerList(game, questionId).map(
            (answer) => answer.teamName,
          ),
        ).not.toContain('Last Second');
      });

      it('stores the answer and has the break grade it when the answer was queued first', async () => {
        const locked = await toLocking();
        const { game, questionId } = locked;
        const held = holdNextCall(game.answerService, 'submit');
        const submitting = submit(game, 1, questionId, '990');
        await held.started;

        const waiting = game.nextWriteWaiting();
        const moving = startPress(locked, pressing);
        await waiting;
        held.release();
        const [ack] = await Promise.all([submitting, moving]);

        expect(ack).toMatchObject({ success: true });
        const stored = await storedAnswers(game, questionId);
        const byTeam = Object.fromEntries(
          stored.map((answer) => [answer.teamName, answer]),
        );
        expect(byTeam['Last Second'].pointsAwarded).toBe(5);
        expect(byTeam['Early Bird'].pointsAwarded).toBe(0);
        expect(byTeam['Last Second'].gradedAt).not.toBeNull();
      });
    },
  );

  describe('kahoot question, against the press that locks it', () => {
    async function toLocking() {
      const opened = await openQuestion(KAHOOT_ROUND);
      await submit(opened.game, 0, opened.questionId, 'Paris');
      await opened.game.act('ADVANCE'); // -> locking
      opened.game.clearEmits();
      return opened;
    }

    it('refuses an answer sent while the lock’s press is held', async () => {
      const locked = await toLocking();
      const { game, questionId } = locked;
      const held = holdNextCall(game.progressRepository, 'save');
      const moving = startPress(locked, 'press');
      await held.started;

      const waiting = game.nextWriteWaiting();
      const submitting = submit(game, 1, questionId, 'Paris');
      await waiting;
      held.release();
      const [, ack] = await Promise.all([moving, submitting]);

      expect(ack).toMatchObject({ success: false, error: LOCKED });
      expect(await storedAnswers(game, questionId)).toHaveLength(1);
    });

    it('speed-scores an answer that was queued before the lock’s press', async () => {
      const locked = await toLocking();
      const { game, questionId } = locked;
      const held = holdNextCall(game.answerService, 'submit');
      const submitting = submit(game, 1, questionId, 'Paris');
      await held.started;

      const waiting = game.nextWriteWaiting();
      const moving = startPress(locked, 'press');
      await waiting;
      held.release();
      await Promise.all([submitting, moving]);

      const stored = await storedAnswers(game, questionId);
      expect(stored).toHaveLength(2);
      for (const answer of stored) {
        expect(answer.pointsAwarded).toBeGreaterThan(0);
      }
    });
  });

  it('does not hold up the next press when an answer store fails once', async () => {
    const { game, questionId } = await openQuestion(CLOSEST_GUESS_ROUND);
    jest
      .spyOn(game.answerService, 'submit')
      .mockRejectedValueOnce(new Error('database is down'));

    await expect(submit(game, 1, questionId, '990')).resolves.toMatchObject({
      success: false,
    });
    const snapshot = await game.act('ADVANCE');

    expect(snapshot.progress.status).toBe('locking');
    jest.restoreAllMocks();
  });
});
