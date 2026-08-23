import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
import { GameStateService } from '@/game/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  type MockSeedService,
} from '@/game/__tests__/test-utils';

// Three rounds across two blocks: Round A + Round B (breakAfter) form block
// 1, Round C (the last round, always forced to break) forms block 2 alone —
// enough to exercise "a block that finished before the current one".
const TWO_BLOCK_GAME: SeededGame = {
  quizId: 9,
  gameSessionId: 901,
  joinCode: 'PQPQPQ',
  rounds: [
    {
      id: 91,
      title: 'Round A',
      breakAfter: false,
      questions: [
        {
          id: 101,
          type: 'free_text',
          prompt: 'Q-A1',
          points: 1,
          answer: 'Answer-A1',
        },
      ],
    },
    {
      id: 92,
      title: 'Round B',
      breakAfter: true,
      questions: [
        {
          id: 102,
          type: 'free_text',
          prompt: 'Q-B1',
          points: 1,
          answer: 'Answer-B1',
        },
      ],
    },
    {
      id: 93,
      title: 'Round C',
      breakAfter: true,
      questions: [
        {
          id: 103,
          type: 'free_text',
          prompt: 'Q-C1',
          points: 1,
          answer: 'Answer-C1',
        },
      ],
    },
  ],
  settings: DEFAULT_SESSION_SETTINGS,
};

describe('GameStateService — past-block revealed questions', () => {
  async function createService(): Promise<GameStateService> {
    const seedService = {
      seed: jest.fn().mockResolvedValue(TWO_BLOCK_GAME),
      loadGame: jest.fn(),
      createSession: jest.fn(),
    };
    const service = new GameStateService(
      asSeedService(seedService as unknown as MockSeedService),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
    );
    await service.onModuleInit();
    return service;
  }

  const joinCode = TWO_BLOCK_GAME.joinCode;

  it('exposes no past-block questions before any block has finished', async () => {
    const service = await createService();
    expect(service.getSnapshot(joinCode).pastRevealedQuestions).toEqual([]);

    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    const opened = await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1 (still block 1)
    expect(opened.pastRevealedQuestions).toEqual([]);
  });

  it("carries the first block's answers into the second block, alongside (not instead of) the second block's own blockQuestions", async () => {
    const service = await createService();
    await service.applyAction(joinCode, 'START_QUIZ');
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(0)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r1q1 (101)
    await service.applyAction(joinCode, 'ADVANCE'); // -> round_intro(1) (round A has no break)
    await service.applyAction(joinCode, 'ADVANCE'); // -> r2q1 (102)
    await service.applyAction(joinCode, 'ADVANCE'); // -> locking
    await service.applyAction(joinCode, 'ADVANCE'); // -> break_intro
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round A)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal (101)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal_intro (round B)
    await service.applyAction(joinCode, 'ADVANCE'); // -> reveal (102)
    // Advancing past the block's last reveal question crosses into block 2's
    // round_intro — nothing in round C has been opened yet.
    const roundCIntro = await service.applyAction(joinCode, 'ADVANCE');

    expect(roundCIntro.progress.status).toBe('round_intro');
    expect(roundCIntro.blockQuestions).toEqual([]);
    expect(
      roundCIntro.pastRevealedQuestions.map((q) => [
        q.id,
        q.answer,
        q.roundNumber,
        q.questionNumberInRound,
        q.roundTitle,
      ]),
    ).toEqual([
      [101, 'Answer-A1', 1, 1, 'Round A'],
      [102, 'Answer-B1', 2, 1, 'Round B'],
    ]);

    // Once round C's own question opens, it shows up in blockQuestions
    // (answer-free, still in progress) while the finished first block stays
    // fully visible in pastRevealedQuestions.
    const roundCOpen = await service.applyAction(joinCode, 'ADVANCE'); // -> r3q1 (103)
    expect(roundCOpen.blockQuestions.map((q) => q.id)).toEqual([103]);
    expect(roundCOpen.blockQuestions[0]).not.toHaveProperty('answer');
    expect(roundCOpen.pastRevealedQuestions.map((q) => q.id)).toEqual([
      101, 102,
    ]);
  });
});
