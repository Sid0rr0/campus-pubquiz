import {
  REAL_STORE_JOIN_CODE,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

// Two single-question blocks: Round A breaks after itself, Round B is last.
describe('GameGateway — opened questions', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let idA: number;
  let idB: number;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
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
      ],
    });
    [[idA], [idB]] = game.rounds.map((round) => round.questionIds);
  });

  const openedIds = (target: RealStoreGateway = game): number[] =>
    [...target.gameState.getOpenedQuestionIds(REAL_STORE_JOIN_CODE)].sort(
      (a, b) => a - b,
    );

  async function openBlockTwoFirstQuestion(): Promise<void> {
    for (const action of [
      'START_QUIZ', // -> rules
      'ADVANCE', // -> round_intro(A)
      'ADVANCE', // -> A1 open
      'ADVANCE', // -> locking
      'ADVANCE', // -> break_intro
      'ADVANCE', // -> reveal_intro
      'ADVANCE', // -> reveal (A1)
      'ADVANCE', // -> round_intro(B)
      'ADVANCE', // -> round_intro(B), second screen
      'ADVANCE', // -> B1 open
    ] as const) {
      await game.act(action);
    }
  }

  it('has opened nothing before the first question opens', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(A)

    expect(openedIds()).toEqual([]);
  });

  it('counts a question as opened the moment it opens', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE');
    await game.act('ADVANCE'); // -> A1 open

    expect(openedIds()).toEqual([idA]);
  });

  it('keeps a question opened after Previous steps back across the block start', async () => {
    await openBlockTwoFirstQuestion();
    expect(openedIds()).toEqual([idA, idB]);

    await game.act('PREVIOUS'); // -> round_intro(B)
    await game.act('PREVIOUS'); // -> round_intro(B), first screen
    const reveal = await game.act('PREVIOUS'); // -> block 1's reveal
    expect(reveal.progress.status).toBe('reveal_intro');

    expect(openedIds()).toEqual([idA, idB]);
  });

  it('has the same opened questions after a backend restart', async () => {
    await openBlockTwoFirstQuestion();
    await game.act('PREVIOUS');
    await game.act('PREVIOUS');
    await game.act('PREVIOUS');

    const restarted = await game.restart();

    expect(openedIds(restarted)).toEqual([idA, idB]);
  });

  it('falls back to what the position implies for a session saved without opened questions', async () => {
    await openBlockTwoFirstQuestion();
    await game.inRequestContext(() =>
      game.orm.em
        .fork()
        .getConnection()
        .execute('UPDATE game_sessions SET opened_question_ids = NULL'),
    );

    const restarted = await game.restart();

    expect(openedIds(restarted)).toEqual([idA, idB]);
  });
});
