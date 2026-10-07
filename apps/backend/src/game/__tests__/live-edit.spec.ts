import type {
  GameAction,
  ImportRoundPreview,
  QuizDraftSaveRequest,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';

const freeText = (prompt: string, points = 1) => ({
  type: 'free_text' as const,
  prompt,
  answer: `Answer to ${prompt}`,
  points,
});

const ROUNDS = [
  {
    title: 'Round A',
    breakAfter: true,
    questions: [freeText('Q1', 3), freeText('Q2'), freeText('Q3')],
  },
  { title: 'Round B', breakAfter: true, questions: [freeText('Q4')] },
];

describe('Live edit — saving a quiz while sessions play it', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: ROUNDS,
      teamNames: ['Saturn Fans'],
    });
    admin = await game.connectAdmin();
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action); // -> rules -> round_intro(A) -> Q1 open
    }
  });

  /** The stored quiz as the editor loads it, passed through `edit`, ready to save. */
  async function draftEdited(
    edit: (rounds: ImportRoundPreview[]) => ImportRoundPreview[],
    quizId = game.quizId,
  ): Promise<QuizDraftSaveRequest> {
    const draft = await game.inRequestContext(() =>
      game.quizService.findDraftById(quizId),
    );
    return { title: draft!.title, rounds: edit(draft!.rounds) };
  }

  const withoutQuestion =
    (roundIndex: number, questionIndex: number) =>
    (rounds: ImportRoundPreview[]) =>
      rounds.map((round, index) =>
        index === roundIndex
          ? {
              ...round,
              questions: round.questions.filter((_, i) => i !== questionIndex),
            }
          : round,
      );

  const withPrompt =
    (roundIndex: number, prompt: string) => (rounds: ImportRoundPreview[]) =>
      rounds.map((round, index) =>
        index === roundIndex
          ? {
              ...round,
              questions: round.questions.map((question) => ({
                ...question,
                prompt,
              })),
            }
          : round,
      );

  function save(request: QuizDraftSaveRequest, quizId = game.quizId) {
    return game.inRequestContext(() => game.liveEdit.save(quizId, request));
  }

  function press(action: GameAction, socket = admin) {
    return game.gateway.handleAdminAction(asSocket(socket), { action });
  }

  const onAirPrompt = async (joinCode?: string) =>
    (await game.snapshot(joinCode)).currentQuestion?.prompt;

  const storedPrompts = async (quizId = game.quizId, roundIndex = 0) =>
    (
      await game.inRequestContext(() => game.quizService.findDraftById(quizId))
    )?.rounds[roundIndex].questions.map((question) => question.prompt);

  it('refuses a save that deletes the next question when the press opening it lands first, leaving the on-air question alone', async () => {
    const request = await draftEdited(withoutQuestion(0, 1)); // drop Q2
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press('ADVANCE'); // opens Q2
    await held.started;
    const waiting = game.nextWriteWaiting();
    const saving = save(request);
    const refused = expect(saving).rejects.toBeInstanceOf(
      QuizLiveEditBlockedError,
    );
    await waiting;

    held.release();
    await pressing;
    await refused;

    expect(await onAirPrompt()).toBe('Q2');
    expect(await storedPrompts()).toEqual(['Q1', 'Q2', 'Q3']);
  });

  it('opens the question that follows when the save deleting the next question lands before the press', async () => {
    const request = await draftEdited(withoutQuestion(0, 1)); // drop Q2
    const held = holdNextCall(game.quizService, 'update');
    const saving = save(request);
    await held.started;
    const waiting = game.nextWriteWaiting();
    const pressing = press('ADVANCE');
    await waiting;

    held.release();
    await Promise.all([saving, pressing]);

    expect(await storedPrompts()).toEqual(['Q1', 'Q3']);
    expect(await onAirPrompt()).toBe('Q3');
  });

  it('lands a save the frontier allows during a press, and the session carries on from the same opened question', async () => {
    const request = await draftEdited(withPrompt(1, 'Q4 reworded'));
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press('ADVANCE'); // opens Q2
    await held.started;
    const waiting = game.nextWriteWaiting();
    const saving = save(request);
    await waiting;

    held.release();
    await Promise.all([pressing, saving]);

    expect(await storedPrompts(game.quizId, 1)).toEqual(['Q4 reworded']);
    expect(await onAirPrompt()).toBe('Q2');
  });

  it('keeps a grade made at the moment of an answer-key fix, with nothing left ungraded', async () => {
    const [team] = game.teams;
    const questionId = game.rounds[0].questionIds[0];
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value: 'Saturn',
    });
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    const request = await draftEdited((rounds) =>
      rounds.map((round, index) =>
        index === 0
          ? {
              ...round,
              questions: round.questions.map((question, i) =>
                i === 0 ? { ...question, answer: 'Saturn' } : question,
              ),
            }
          : round,
      ),
    );

    const held = holdNextCall(game.seedService, 'loadGame');
    const saving = save(request);
    await held.started;
    const waiting = game.nextWriteWaiting();
    const grading = game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 2,
    });
    await waiting;
    held.release();
    await Promise.all([saving, grading]);

    const [stored] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    expect(stored.pointsAwarded).toBe(2);
    expect((await game.snapshot()).ungradedQuestionIds).toEqual([]);
  });

  describe('with a second session on the same quiz', () => {
    let otherAdmin: MockSocket;
    let otherJoinCode: string;

    beforeEach(async () => {
      const created = await game.inRequestContext(() =>
        game.gameState.createSession(game.quizId),
      );
      otherJoinCode = created.joinCode;
      otherAdmin = await game.connectAdmin(otherJoinCode);
      // The second session runs one question ahead: Q2 is open there.
      for (const action of [
        'START_QUIZ',
        'ADVANCE',
        'ADVANCE',
        'ADVANCE',
      ] as const) {
        await press(action, otherAdmin);
      }
    });

    it('checks the save against both sessions', async () => {
      const request = await draftEdited(withoutQuestion(0, 1)); // drop Q2

      await expect(save(request)).rejects.toBeInstanceOf(
        QuizLiveEditBlockedError,
      );
      expect(await storedPrompts()).toEqual(['Q1', 'Q2', 'Q3']);
    });

    it('waits for a press held on the other session', async () => {
      const request = await draftEdited(withPrompt(1, 'Q4 reworded'));
      const updateSpy = jest.spyOn(game.quizService, 'update');
      const held = holdNextCall(game.progressRepository, 'save');
      const pressing = press('ADVANCE', otherAdmin);
      await held.started;
      // The save claims each session's queue in join-code order; only the claim
      // on the session with the press in flight has to wait.
      const claims = [game.joinCode, otherJoinCode]
        .sort()
        .map(() => game.nextWriteWaiting());
      const saving = save(request);
      await claims[
        [game.joinCode, otherJoinCode].sort().indexOf(otherJoinCode)
      ];

      expect(updateSpy).not.toHaveBeenCalled();
      held.release();
      await Promise.all([pressing, saving]);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(await onAirPrompt(otherJoinCode)).toBe('Q3');
    });
  });

  it("isn't held up by a press on a session playing another quiz", async () => {
    const other = await game.inRequestContext(() =>
      game.quizService.create('Another quiz', [
        {
          title: 'Only round',
          breakAfter: true,
          questions: [freeText('X1'), freeText('X2')],
        },
      ]),
    );
    const created = await game.inRequestContext(() =>
      game.gameState.createSession(other.quizId),
    );
    const otherAdmin = await game.connectAdmin(created.joinCode);
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await press(action, otherAdmin);
    }
    const request = await draftEdited(
      withPrompt(0, 'X reworded'),
      other.quizId,
    );

    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press('ADVANCE'); // on the first quiz
    await held.started;
    await save(request, other.quizId);
    held.release();
    await pressing;

    expect(await storedPrompts(other.quizId)).toEqual([
      'X reworded',
      'X reworded',
    ]);
  });
});
