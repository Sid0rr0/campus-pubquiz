import { asSocket } from '@/game/__tests__/test-utils';
import {
  TWO_ROUND_QUIZ,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — response indicators', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let questionIds: number[];

  beforeEach(async () => {
    // Two rounds in one block (round 2 has the break), four questions.
    game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: TWO_ROUND_QUIZ,
    });
    questionIds = game.rounds.flatMap((round) => round.questionIds);
  });

  /** Whether a submit to the question is accepted (answering open) or rejected as locked. */
  async function isOpenForAnswering(questionId: number): Promise<boolean> {
    const [{ socket, teamId }] = game.teams;
    const ack = await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value: 'anything',
    });
    return ack.success;
  }

  async function actAll(actions: ('START_QUIZ' | 'ADVANCE')[]) {
    for (const action of actions) await game.act(action);
  }

  const TO_FIRST_QUESTION = ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const;

  it('treats every revealed block question as open for answering', async () => {
    await actAll([...TO_FIRST_QUESTION, 'ADVANCE']); // -> r1q2

    expect(await isOpenForAnswering(questionIds[0])).toBe(true);
    expect(await isOpenForAnswering(questionIds[1])).toBe(true);
  });

  it('treats unrevealed and unknown questions as closed for answering', async () => {
    await actAll([...TO_FIRST_QUESTION]); // -> r1q1

    expect(await isOpenForAnswering(questionIds[2])).toBe(false);
    expect(await isOpenForAnswering(999999)).toBe(false);
  });

  it('keeps the last question open for answering during the locking countdown', async () => {
    await actAll([
      ...TO_FIRST_QUESTION,
      'ADVANCE', // -> r1q2
      'ADVANCE', // -> round_intro(1)
      'ADVANCE', // -> r2q1
      'ADVANCE', // -> r2q2
    ]);
    const locking = await game.act('ADVANCE');

    expect(locking.progress.status).toBe('locking');
    expect(await isOpenForAnswering(questionIds[3])).toBe(true);
  });

  it('closes the whole block for answering once the break starts', async () => {
    await actAll([
      ...TO_FIRST_QUESTION,
      'ADVANCE', // -> r1q2
      'ADVANCE', // -> round_intro(1)
      'ADVANCE', // -> r2q1
      'ADVANCE', // -> r2q2
      'ADVANCE', // -> locking
      'ADVANCE', // -> break_intro
    ]);

    expect(await isOpenForAnswering(questionIds[0])).toBe(false);
    expect(await isOpenForAnswering(questionIds[3])).toBe(false);
  });

  it('closes answering while still in the lobby', async () => {
    expect(await isOpenForAnswering(questionIds[0])).toBe(false);
  });

  it('closes answering while showing the rules screen', async () => {
    await game.act('START_QUIZ');

    expect(await isOpenForAnswering(questionIds[0])).toBe(false);
  });

  it('starts with no answered team ids', async () => {
    expect((await game.snapshot()).answeredTeamIds).toEqual([]);
  });

  it('reflects answered team ids for the current question only', async () => {
    const [{ teamId }] = game.teams;
    await actAll([...TO_FIRST_QUESTION]); // -> r1q1
    await isOpenForAnswering(questionIds[0]);

    expect((await game.snapshot()).answeredTeamIds).toEqual([teamId]);

    const nextQuestion = await game.act('ADVANCE'); // -> r1q2, nobody answered it yet
    expect(nextQuestion.answeredTeamIds).toEqual([]);
  });

  it('does not carry stale answered team ids over into a newly created session', async () => {
    await actAll([...TO_FIRST_QUESTION]);
    await isOpenForAnswering(questionIds[0]);
    await game.act('END_QUIZ');

    // Same quiz, so the same question ids: stale indicators would leak into
    // the new session if it inherited them.
    const { joinCode } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const adminForNewSession = await game.connectAdmin(joinCode);
    for (const action of TO_FIRST_QUESTION) {
      await game.gateway.handleAdminAction(asSocket(adminForNewSession), {
        action,
      });
    }

    expect((await game.snapshot(joinCode)).answeredTeamIds).toEqual([]);
  });
});
