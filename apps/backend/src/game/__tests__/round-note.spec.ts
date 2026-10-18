import { SOCKET_ROOMS, type ImportRoundPreview } from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const ROUND_NOTE = 'Answers must be in English.\nNo phones.';

const NOTED_QUIZ: QuizRoundSpec[] = [
  {
    title: 'Music',
    breakAfter: true,
    note: ROUND_NOTE,
    questions: [
      { type: 'free_text', prompt: 'Band?', answer: 'ABBA', points: 1 },
    ],
  },
];

describe('Round note — host-only context for a round intro', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  const presenterNote = () =>
    game.gameState.getPresenterContext(game.joinCode).currentRoundNote;

  async function advance(times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await game.act('ADVANCE');
    }
  }

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: NOTED_QUIZ,
      teamNames: ['The Quizzards'],
    });
  });

  it('gives the round note while the round intro is on air', async () => {
    await game.act('START_QUIZ');
    await advance(1); // -> round_intro

    expect(presenterNote()).toBe(ROUND_NOTE);
  });

  it('gives null on an open question', async () => {
    await game.act('START_QUIZ');
    await advance(2); // -> question open

    expect(presenterNote()).toBeNull();
  });

  it('gives null on the reveal intro', async () => {
    await game.act('START_QUIZ');
    await advance(5); // -> question, locking, break_intro, reveal_intro

    expect(game.gameState.getSnapshot(game.joinCode).progress.status).toBe(
      'reveal_intro',
    );
    expect(presenterNote()).toBeNull();
  });

  it('gives the round note again when break review steps back across the round intro', async () => {
    await game.act('START_QUIZ');
    await advance(4); // -> break_intro
    await game.act('PREVIOUS'); // -> break
    await game.act('PREVIOUS'); // -> break_round_intro

    expect(game.gameState.getSnapshot(game.joinCode).progress.status).toBe(
      'break_round_intro',
    );
    expect(presenterNote()).toBe(ROUND_NOTE);
  });

  it('gives null for a round without a note', async () => {
    game = await harness.createGateway({
      joinCode: 'NONOTE',
      rounds: [{ ...NOTED_QUIZ[0], note: undefined }],
    });
    await game.act('START_QUIZ');
    await advance(1);

    expect(presenterNote()).toBeNull();
  });

  it('puts the note in no display or players view', async () => {
    await game.act('START_QUIZ');
    await advance(1); // -> round_intro

    for (const room of [SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.PLAYERS]) {
      expect(
        JSON.stringify(game.gameState.getView(game.joinCode, room)),
      ).not.toContain('Answers must be in English');
    }
  });

  describe('editing the note while live', () => {
    async function saveNote(roundIndex: number, note: string) {
      const draft = await game.inRequestContext(() =>
        game.quizService.findDraftById(game.quizId),
      );
      const rounds: ImportRoundPreview[] = draft!.rounds.map((round, index) =>
        index === roundIndex ? { ...round, note } : round,
      );
      await game.inRequestContext(() =>
        game.liveEdit.save(game.quizId, { title: draft!.title, rounds }),
      );
    }

    it('reaches the presenter context when the current round is edited', async () => {
      await game.act('START_QUIZ');
      await advance(1); // -> round_intro

      await saveNote(0, '  Fixed typo  ');

      expect(presenterNote()).toBe('Fixed typo');
    });

    it('is accepted for a round already played', async () => {
      await game.act('START_QUIZ');
      await advance(4); // -> break_intro, the round is played

      await expect(saveNote(0, 'Played-round fix')).resolves.not.toThrow();
    });
  });

  describe('saving a draft', () => {
    it('round-trips the note, storing a blank one as no note', async () => {
      const draft = await game.inRequestContext(() =>
        game.quizService.findDraftById(game.quizId),
      );
      expect(draft!.rounds[0].note).toBe(ROUND_NOTE);

      await game.inRequestContext(() =>
        game.quizService.update(game.quizId, draft!.title, [
          { ...draft!.rounds[0], note: '   ' },
        ]),
      );
      const reloaded = await game.inRequestContext(() =>
        game.quizService.findDraftById(game.quizId),
      );
      expect(reloaded!.rounds[0].note).toBeUndefined();
    });

    it('rejects a note over 500 characters', async () => {
      const draft = await game.inRequestContext(() =>
        game.quizService.findDraftById(game.quizId),
      );

      await expect(
        game.inRequestContext(() =>
          game.quizService.update(game.quizId, draft!.title, [
            { ...draft!.rounds[0], note: 'x'.repeat(501) },
          ]),
        ),
      ).rejects.toMatchObject({
        issues: [expect.objectContaining({ field: 'note' })],
      });
    });
  });
});
