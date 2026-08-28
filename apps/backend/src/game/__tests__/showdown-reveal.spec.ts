import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/state/game-state.service';
import type { ActiveShowdownRoundState } from '@/game/state/session-state';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeAnswerService,
  createFakeShowdownService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  asShowdownService,
  type MockAnswerService,
  type MockShowdownService,
} from './test-utils';

const SIMPLE_GAME: SeededGame = {
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

function twoTeamRound(): ActiveShowdownRoundState {
  return {
    id: 501,
    question: 'How many people are in this room?',
    answer: '42',
    winnerTeamId: null,
    isTie: false,
    resolved: false,
    participants: [
      { teamId: 31, teamName: 'Team A', seatIndex: 0, guess: null },
      { teamId: 32, teamName: 'Team B', seatIndex: 1, guess: null },
    ],
  };
}

async function buildService(
  answerService: MockAnswerService,
  showdownService: MockShowdownService,
): Promise<GameStateService> {
  const seedService = {
    seed: jest.fn().mockResolvedValue(SIMPLE_GAME),
    loadGame: jest.fn(),
    createSession: jest.fn(),
    updateSettings: jest.fn(),
  };
  const service = new GameStateService(
    asSeedService(seedService),
    asGameProgressRepository(createFakeGameProgressRepository()),
    createFakeOrm(),
    asAnswerService(answerService),
    asShowdownService(showdownService),
  );
  await service.onModuleInit();
  return service;
}

/**
 * Reaches 'ended' via the same END_QUIZ escape hatch the admin's "End Quiz"
 * button uses (legal from any non-ended status) — the showdown-reveal
 * intercept only engages once status is genuinely 'ended' (see
 * GameStateService.applyAction), so tests exercising it need a real 'ended'
 * status rather than a synthetic one.
 */
async function buildServiceAtEnded(
  answerService: MockAnswerService,
  showdownService: MockShowdownService,
  joinCode: string,
): Promise<GameStateService> {
  const service = await buildService(answerService, showdownService);
  const final = await service.applyAction(joinCode, 'END_QUIZ');
  expect(final.progress.status).toBe('ended');
  return service;
}

describe('GameStateService — showdown reveal-step gating', () => {
  const joinCode = 'ABCDEF';

  it("does not intercept ADVANCE before the quiz reaches ended, even with an active round — the block's own reveal keeps driving", async () => {
    const answerService = createFakeAnswerService();
    const showdownService = createFakeShowdownService();
    const service = await buildService(answerService, showdownService);
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // rules -> round_intro
    await service.applyAction(joinCode, 'ADVANCE'); // round_intro -> question_open
    await service.applyAction(joinCode, 'ADVANCE'); // question_open -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // locking -> break_intro
    // Admin composes the tiebreaker question during grading, before the
    // block's own answers have been revealed to the audience.
    const round = twoTeamRound();
    service.setActiveShowdownRound(joinCode, round);

    const stepped = await service.applyAction(joinCode, 'ADVANCE');

    expect(stepped.progress.status).toBe('reveal_intro');
    expect(stepped.showdownRevealStep).toBe(0);
    expect(showdownService.resolve).not.toHaveBeenCalled();
  });

  it('throws ShowdownGuessesPendingError when ADVANCE is pressed before every participant has guessed', async () => {
    const answerService = createFakeAnswerService();
    const showdownService = createFakeShowdownService();
    const service = await buildServiceAtEnded(
      answerService,
      showdownService,
      joinCode,
    );
    const round = twoTeamRound();
    round.participants[0].guess = '40';
    // Team B (seatIndex 1) still hasn't guessed.
    service.setActiveShowdownRound(joinCode, round);

    await expect(service.applyAction(joinCode, 'ADVANCE')).rejects.toThrow(
      'not every team has submitted a guess',
    );
    expect(showdownService.resolve).not.toHaveBeenCalled();
  });

  it('walks ADVANCE through every step once every participant has guessed, resolving on the final step and refreshing the leaderboard', async () => {
    const answerService = createFakeAnswerService();
    answerService.computeLeaderboard.mockResolvedValueOnce([
      {
        teamId: 31,
        teamName: 'Team A',
        totalPoints: 12,
        bonusPoints: 5,
        roundPoints: [],
      },
    ]);
    const showdownService = createFakeShowdownService();
    showdownService.resolve.mockResolvedValueOnce({
      winnerTeamId: 31,
      isTie: false,
    });
    const service = await buildServiceAtEnded(
      answerService,
      showdownService,
      joinCode,
    );
    const round = twoTeamRound();
    round.participants[0].guess = '40';
    round.participants[1].guess = '50';
    service.setActiveShowdownRound(joinCode, round);

    const step1 = await service.applyAction(joinCode, 'ADVANCE');
    expect(step1.showdownRevealStep).toBe(1);
    expect(step1.activeShowdown?.participants[0].guess).toBe('40');
    expect(step1.activeShowdown?.participants[1].guess).toBeUndefined();
    // Never falls through to getNextGameState — status is untouched.
    expect(step1.progress.status).toBe('ended');

    const step2 = await service.applyAction(joinCode, 'ADVANCE');
    expect(step2.showdownRevealStep).toBe(2);
    expect(step2.activeShowdown?.participants[1].guess).toBe('50');
    expect(showdownService.resolve).not.toHaveBeenCalled();

    // Crossing into the final step (N+1 = 3) resolves the round.
    const finalStep = await service.applyAction(joinCode, 'ADVANCE');
    expect(finalStep.showdownRevealStep).toBe(3);
    expect(showdownService.resolve).toHaveBeenCalledWith(round.id);
    expect(showdownService.resolve).toHaveBeenCalledTimes(1);
    expect(finalStep.activeShowdown?.answer).toBe('42');
    expect(finalStep.activeShowdown?.winnerTeamId).toBe(31);
    expect(finalStep.leaderboard).toEqual([
      {
        teamId: 31,
        teamName: 'Team A',
        totalPoints: 12,
        bonusPoints: 5,
        roundPoints: [],
      },
    ]);

    // A repeated ADVANCE at the final step is a harmless no-op.
    const repeated = await service.applyAction(joinCode, 'ADVANCE');
    expect(repeated.showdownRevealStep).toBe(3);
    expect(showdownService.resolve).toHaveBeenCalledTimes(1);
  });

  it('walks PREVIOUS backward without resolving', async () => {
    const answerService = createFakeAnswerService();
    const showdownService = createFakeShowdownService();
    const service = await buildServiceAtEnded(
      answerService,
      showdownService,
      joinCode,
    );
    const round = twoTeamRound();
    round.participants[0].guess = '40';
    round.participants[1].guess = '50';
    service.setActiveShowdownRound(joinCode, round);
    await service.applyAction(joinCode, 'ADVANCE'); // step 1
    await service.applyAction(joinCode, 'ADVANCE'); // step 2

    const back = await service.applyAction(joinCode, 'PREVIOUS');
    expect(back.showdownRevealStep).toBe(1);
    expect(showdownService.resolve).not.toHaveBeenCalled();

    // PREVIOUS at step 0 is a harmless no-op.
    await service.applyAction(joinCode, 'PREVIOUS');
    const atZero = await service.applyAction(joinCode, 'PREVIOUS');
    expect(atZero.showdownRevealStep).toBe(0);
  });
});
