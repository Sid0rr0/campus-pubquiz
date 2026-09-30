import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

// Three rounds across two blocks: Round A + Round B (breakAfter) form block
// 1, Round C (the last round, always forced to break) forms block 2 alone —
// enough to exercise "a block that finished before the current one".
describe('GameGateway — past-block revealed questions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          questions: [
            { type: 'free_text', prompt: 'Q-A1', answer: 'Answer-A1' },
          ],
        },
        {
          title: 'Round B',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Q-B1', answer: 'Answer-B1' },
          ],
        },
        {
          title: 'Round C',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Q-C1', answer: 'Answer-C1' },
          ],
        },
      ],
    });
  });

  it('exposes no past-block questions before any block has finished', async () => {
    expect((await game.snapshot()).pastRevealedQuestions).toEqual([]);

    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    const opened = await game.act('ADVANCE'); // -> r1q1 (still block 1)
    expect(opened.pastRevealedQuestions).toEqual([]);
  });

  it("carries the first block's answers into the second block, alongside (not instead of) the second block's own blockQuestions", async () => {
    const [[idA], [idB], [idC]] = game.rounds.map((round) => round.questionIds);
    for (const action of [
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> r1q1 (A1)
      'ADVANCE', // -> round_intro(1) (round A has no break)
      'ADVANCE', // -> r2q1 (B1)
      'ADVANCE', // -> locking
      'ADVANCE', // -> break_intro
      'ADVANCE', // -> reveal_intro (round A)
      'ADVANCE', // -> reveal (A1)
      'ADVANCE', // -> reveal_intro (round B)
      'ADVANCE', // -> reveal (B1)
    ] as const) {
      await game.act(action);
    }
    // Advancing past the block's last reveal question crosses into block 2's
    // round_intro — nothing in round C has been opened yet.
    const roundCIntro = await game.act('ADVANCE');

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
      [idA, 'Answer-A1', 1, 1, 'Round A'],
      [idB, 'Answer-B1', 2, 1, 'Round B'],
    ]);

    // Once round C's own question opens, it shows up in blockQuestions
    // (answer-free, still in progress) while the finished first block stays
    // fully visible in pastRevealedQuestions.
    const roundCOpen = await game.act('ADVANCE'); // -> r3q1 (C1)
    expect(roundCOpen.blockQuestions.map((q) => q.id)).toEqual([idC]);
    expect(roundCOpen.blockQuestions[0]).not.toHaveProperty('answer');
    expect(roundCOpen.pastRevealedQuestions.map((q) => q.id)).toEqual([
      idA,
      idB,
    ]);
  });
});
