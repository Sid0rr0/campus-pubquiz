import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  type MockSeedService,
} from '@/game/__tests__/test-utils';

describe('GameStateService — block questions and upcoming questions', () => {
  let service: GameStateService;
  let joinCode: string;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    joinCode = 'ABCDEF';
  });

  it('exposes no block questions in the lobby', () => {
    expect(service.getSnapshot(joinCode).blockQuestions).toEqual([]);
  });

  it('reveals block questions cumulatively as the admin advances', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    expect(
      service.getSnapshot(joinCode).blockQuestions.map((q) => q.id),
    ).toEqual([21]);

    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1) (round 1 has no break)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (same block)
    expect(
      service.getSnapshot(joinCode).blockQuestions.map((q) => q.id),
    ).toEqual([21, 22, 23]);
  });

  it('keeps an already-opened question answerable after the admin steps the display back with PREVIOUS', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (23) — furthest reached: r1q1, r1q2, r2q1
    expect(
      service.getSnapshot(joinCode).blockQuestions.map((q) => q.id),
    ).toEqual([21, 22, 23]);

    await service.applyAction(joinCode, 'PREVIOUS'); // -> round_intro(1)
    const back = await service.applyAction(joinCode, 'PREVIOUS'); // -> r1q2 (22) again, display steps backward

    expect(back.progress.status).toBe('question_open');
    expect(back.currentQuestion?.id).toBe(22);
    // r2q1 was already shown on display before stepping back — it must stay
    // revealed/answerable for players even though it's no longer on screen.
    expect(back.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23]);
    expect(service.isQuestionOpenForAnswering(joinCode, 23)).toBe(true);
    // Only r2q2 has genuinely never been shown yet.
    expect(back.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);
  });

  it("shows no block questions yet on a fresh round's intro card, with the whole round upcoming", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    const freshIntro = await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1), nothing opened in round 1 yet

    expect(freshIntro.progress.status).toBe('round_intro');
    expect(freshIntro.blockQuestions.map((q) => q.id)).toEqual([21, 22]);
    expect(freshIntro.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 1 },
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);
  });

  it("keeps a round's questions answerable directly on its intro card when Previous steps back into it", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (23), furthest reached: r1q1, r1q2, r2q1

    const backOnIntroCard = await service.applyAction(joinCode, 'PREVIOUS'); // -> round_intro(1), r2q1 already open

    expect(backOnIntroCard.progress.status).toBe('round_intro');
    expect(backOnIntroCard.currentQuestion).toBeNull();
    // r2q1 stays revealed/answerable underneath the intro card, same as
    // Previous stepping back onto an already-open question directly.
    expect(backOnIntroCard.blockQuestions.map((q) => q.id)).toEqual([
      21, 22, 23,
    ]);
    expect(service.isQuestionOpenForAnswering(joinCode, 23)).toBe(true);
    expect(backOnIntroCard.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);
  });

  it('keeps the whole locked block browsable during the grading break', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro

    expect(snapshot.progress.status).toBe('break_intro');
    expect(snapshot.blockQuestions.map((q) => q.id)).toEqual([21, 22, 23, 24]);
  });

  it('never leaks the correct answer through blockQuestions, even during break', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> break

    snapshot.blockQuestions.forEach((question) => {
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('answerMediaUrl');
    });
  });

  it('never leaks the correct answer through currentQuestion while a question is open', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1

    expect(snapshot.currentQuestion).not.toHaveProperty('answer');
    expect(snapshot.currentQuestion).not.toHaveProperty('answerMediaUrl');
  });

  it('labels block questions with their round and in-round position', async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    const snapshot = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2

    expect(
      snapshot.blockQuestions.map((q) => [
        q.id,
        q.roundNumber,
        q.questionNumberInRound,
      ]),
    ).toEqual([
      [21, 1, 1],
      [22, 1, 2],
      [23, 2, 1],
      [24, 2, 2],
    ]);
  });

  it("exposes the current round's remaining question as upcoming while a question is open", async () => {
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const r1q1 = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    expect(r1q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2 },
    ]);

    const r1q2 = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    expect(r1q2.upcomingQuestions).toEqual([]);

    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    const r2q1 = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    expect(r2q1.upcomingQuestions).toEqual([
      { roundNumber: 2, questionNumberInRound: 2 },
    ]);

    const r2q2 = await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    expect(r2q2.upcomingQuestions).toEqual([]);
  });

  it('exposes every remaining question in the round as upcoming, not just the next one', async () => {
    const threeQuestionRoundGame: SeededGame = {
      quizId: 3,
      gameSessionId: 103,
      joinCode: 'ZZZZZZ',
      rounds: [
        {
          id: 31,
          title: 'Triple Round',
          breakAfter: true,
          questions: [
            {
              id: 41,
              type: 'free_text',
              prompt: 'Q1',
              points: 1,
              answer: 'A1',
            },
            {
              id: 42,
              type: 'free_text',
              prompt: 'Q2',
              points: 1,
              answer: 'A2',
            },
            {
              id: 43,
              type: 'free_text',
              prompt: 'Q3',
              points: 1,
              answer: 'A3',
            },
          ],
        },
      ],
      settings: DEFAULT_SESSION_SETTINGS,
    };
    const customSeedService = {
      seed: jest.fn().mockResolvedValue(threeQuestionRoundGame),
      loadGame: jest.fn(),
      createSession: jest.fn(),
    };
    const customService = new GameStateService(
      asSeedService(customSeedService as unknown as MockSeedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await customService.onModuleInit();
    const customJoinCode = threeQuestionRoundGame.joinCode;

    await customService.applyAction(customJoinCode, 'START_QUIZ');
    await customService.applyAction(customJoinCode, 'ADVANCE'); // -> round_intro(0)
    const q1 = await customService.applyAction(customJoinCode, 'ADVANCE'); // -> q1
    expect(q1.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 2 },
      { roundNumber: 1, questionNumberInRound: 3 },
    ]);

    const q2 = await customService.applyAction(customJoinCode, 'ADVANCE'); // -> q2
    expect(q2.upcomingQuestions).toEqual([
      { roundNumber: 1, questionNumberInRound: 3 },
    ]);

    const q3 = await customService.applyAction(customJoinCode, 'ADVANCE'); // -> q3
    expect(q3.upcomingQuestions).toEqual([]);
  });

  it('exposes no upcoming questions outside question_open/locking', async () => {
    expect(service.getSnapshot(joinCode).upcomingQuestions).toEqual([]);

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q2
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q2
    const locking = await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    expect(locking.upcomingQuestions).toEqual([]);

    const brk = await service.applyAction(joinCode, 'ADVANCE'); // -> break
    expect(brk.upcomingQuestions).toEqual([]);

    const revealed = await service.applyAction(joinCode, 'ADVANCE'); // -> reveal
    expect(revealed.upcomingQuestions).toEqual([]);
  });
});
