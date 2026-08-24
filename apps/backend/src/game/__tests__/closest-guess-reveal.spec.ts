import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  type MockAnswerService,
} from './test-utils';

const CLOSEST_GUESS_GAME: SeededGame = {
  quizId: 1,
  gameSessionId: 101,
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 11,
      title: 'Round 1',
      breakAfter: true,
      questions: [
        {
          id: 21,
          type: 'closest_guess',
          prompt: 'How many students attend this university?',
          points: 5,
          answer: '1000',
        },
        {
          id: 22,
          type: 'free_text',
          prompt: 'Name a fruit',
          points: 1,
          answer: 'Apple',
        },
      ],
    },
  ],
  settings: DEFAULT_SESSION_SETTINGS,
};

const GRADED_ANSWERS = [
  {
    answerId: 41,
    teamId: 31,
    teamName: 'Team A',
    value: '900',
    pointsAwarded: 0,
    gradedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    answerId: 42,
    teamId: 32,
    teamName: 'Team B',
    value: '950',
    pointsAwarded: 5,
    gradedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    answerId: 43,
    teamId: 33,
    teamName: 'Team C',
    value: '2000',
    pointsAwarded: 0,
    gradedAt: '2026-01-01T00:00:00.000Z',
  },
];

async function buildService(
  answerService: MockAnswerService,
  game: SeededGame = CLOSEST_GUESS_GAME,
): Promise<GameStateService> {
  const seedService = {
    seed: jest.fn().mockResolvedValue(game),
    loadGame: jest.fn(),
    createSession: jest.fn(),
    updateSettings: jest.fn(),
  };
  const service = new GameStateService(
    asSeedService(seedService),
    asGameProgressRepository(createFakeGameProgressRepository()),
    createFakeOrm(),
    asAnswerService(answerService),
  );
  await service.onModuleInit();
  return service;
}

/** Opens both questions, locks, and walks the admin into reveal(revealIndex=0). */
async function openBlockAndEnterReveal(
  service: GameStateService,
  joinCode: string,
): Promise<void> {
  await service.applyAction(joinCode, 'START_QUIZ');
  await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
  await service.applyAction(joinCode, 'ADVANCE'); // -> q1 (closest_guess)
  await service.applyAction(joinCode, 'ADVANCE'); // -> q2 (free_text)
  await service.applyAction(joinCode, 'ADVANCE'); // -> locking
  await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro (grading runs here)
  await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro(revealIndex 0)
  await service.applyAction(joinCode, 'ADVANCE'); // -> reveal(revealIndex 0)
}

describe('GameStateService — closest_guess reveal-step gating', () => {
  const joinCode = 'ABCDEF';

  it('grades the closest_guess question once the block locks, before reveal starts', async () => {
    const answerService = createFakeAnswerService();
    answerService.gradeClosestGuess.mockResolvedValueOnce(GRADED_ANSWERS);
    const service = await buildService(answerService);

    await openBlockAndEnterReveal(service, joinCode);

    expect(answerService.gradeClosestGuess).toHaveBeenCalledWith(
      101,
      21,
      '1000',
      5,
    );
    expect(answerService.gradeClosestGuess).toHaveBeenCalledTimes(1);
  });

  it('refreshes the leaderboard as soon as the closest_guess question is auto-graded', async () => {
    const answerService = createFakeAnswerService();
    answerService.gradeClosestGuess.mockResolvedValueOnce(GRADED_ANSWERS);
    answerService.computeLeaderboard.mockResolvedValueOnce([
      {
        teamId: 32,
        teamName: 'Team B',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
    const service = await buildService(answerService);

    // break_intro is where ensureBlockGraded runs gradeClosestGuess — the
    // leaderboard must already reflect the new points on this very snapshot,
    // not just after a later GRADE_ANSWER/TOGGLE_LEADERBOARD action.
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> q1 (closest_guess)
    await service.applyAction(joinCode, 'ADVANCE'); // -> q2 (free_text)
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    const graded = await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro

    expect(answerService.computeLeaderboard).toHaveBeenCalledWith(101);
    expect(graded.leaderboard).toEqual([
      {
        teamId: 32,
        teamName: 'Team B',
        totalPoints: 5,
        bonusPoints: 0,
        roundPoints: [],
      },
    ]);
  });

  it('walks ADVANCE through all 5 cumulative reveal steps before moving to the next question', async () => {
    const answerService = createFakeAnswerService();
    answerService.gradeClosestGuess.mockResolvedValueOnce(GRADED_ANSWERS);
    const service = await buildService(answerService);
    await openBlockAndEnterReveal(service, joinCode);

    // Step 0: just the question, nothing revealed yet.
    const step0 = service.getSnapshot(joinCode);
    expect(step0.progress.revealIndex).toBe(0);
    expect(step0.closestGuessRevealStep).toBe(0);
    expect(step0.revealQuestions[0].closestGuess).toEqual({
      hasSubmissions: true,
      minGuess: '900',
      maxGuess: '2000',
      closestGuesses: [{ teamName: 'Team B', value: '950' }],
    });

    const step1 = await service.applyAction(joinCode, 'ADVANCE');
    expect(step1.progress.status).toBe('reveal');
    expect(step1.progress.revealIndex).toBe(0);
    expect(step1.closestGuessRevealStep).toBe(1);

    const step2 = await service.applyAction(joinCode, 'ADVANCE');
    expect(step2.closestGuessRevealStep).toBe(2);
    expect(step2.progress.revealIndex).toBe(0);

    const step3 = await service.applyAction(joinCode, 'ADVANCE');
    expect(step3.closestGuessRevealStep).toBe(3);
    expect(step3.progress.revealIndex).toBe(0);

    const step4 = await service.applyAction(joinCode, 'ADVANCE');
    expect(step4.closestGuessRevealStep).toBe(4);
    expect(step4.progress.revealIndex).toBe(0);

    // A 6th ADVANCE finally moves on to the block's next question.
    const nextQuestion = await service.applyAction(joinCode, 'ADVANCE');
    expect(nextQuestion.progress.revealIndex).toBe(1);
    expect(nextQuestion.closestGuessRevealStep).toBe(0);
  });

  it("walks PREVIOUS backward symmetrically, landing on the previous question's last step", async () => {
    const answerService = createFakeAnswerService();
    answerService.gradeClosestGuess.mockResolvedValueOnce(GRADED_ANSWERS);
    const service = await buildService(answerService);
    await openBlockAndEnterReveal(service, joinCode);
    await service.applyAction(joinCode, 'ADVANCE'); // step 1
    await service.applyAction(joinCode, 'ADVANCE'); // step 2
    await service.applyAction(joinCode, 'ADVANCE'); // step 3
    await service.applyAction(joinCode, 'ADVANCE'); // step 4
    await service.applyAction(joinCode, 'ADVANCE'); // -> revealIndex 1 (q2)

    const backToQ1 = await service.applyAction(joinCode, 'PREVIOUS');
    expect(backToQ1.progress.revealIndex).toBe(0);
    expect(backToQ1.closestGuessRevealStep).toBe(4);

    const backToStep3 = await service.applyAction(joinCode, 'PREVIOUS');
    expect(backToStep3.progress.revealIndex).toBe(0);
    expect(backToStep3.closestGuessRevealStep).toBe(3);

    await service.applyAction(joinCode, 'PREVIOUS'); // step 2
    await service.applyAction(joinCode, 'PREVIOUS'); // step 1
    await service.applyAction(joinCode, 'PREVIOUS'); // step 0

    const backToIntro = await service.applyAction(joinCode, 'PREVIOUS');
    expect(backToIntro.progress.status).toBe('reveal_intro');
  });

  it('collapses to a single reveal step when nobody submitted a guess', async () => {
    const answerService = createFakeAnswerService();
    answerService.gradeClosestGuess.mockResolvedValueOnce([]);
    const service = await buildService(answerService);

    await openBlockAndEnterReveal(service, joinCode);

    const step0 = service.getSnapshot(joinCode);
    expect(step0.closestGuessRevealStep).toBe(0);
    expect(step0.revealQuestions[0].closestGuess).toEqual({
      hasSubmissions: false,
      closestGuesses: [],
    });

    // A single ADVANCE moves straight to the next question — no gated steps.
    const nextQuestion = await service.applyAction(joinCode, 'ADVANCE');
    expect(nextQuestion.progress.revealIndex).toBe(1);
  });
});
