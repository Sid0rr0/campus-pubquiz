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

  it('gives the round note on the reveal intro', async () => {
    await game.act('START_QUIZ');
    await advance(5); // -> question, locking, break_intro, reveal_intro

    expect(game.gameState.getSnapshot(game.joinCode).progress.status).toBe(
      'reveal_intro',
    );
    expect(presenterNote()).toBe(ROUND_NOTE);
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

  describe('on the big screen (show on screen)', () => {
    const displayNote = () => {
      const { screen } = game.gameState.getView(
        game.joinCode,
        SOCKET_ROOMS.DISPLAY,
      );
      return screen.kind === 'round_title' ||
        screen.kind === 'break_round_title'
        ? screen.note
        : '';
    };
    const playersCarryNote = () =>
      JSON.stringify(
        game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS),
      ).includes('Answers must be in English');

    async function setShown(isShown: boolean, note = ROUND_NOTE) {
      const draft = await game.inRequestContext(() =>
        game.quizService.findDraftById(game.quizId),
      );
      const rounds: ImportRoundPreview[] = draft!.rounds.map((round) => ({
        ...round,
        note,
        showNoteOnScreen: isShown,
      }));
      await game.inRequestContext(() =>
        game.liveEdit.save(game.quizId, { title: draft!.title, rounds }),
      );
    }

    it('carries no note on the display view while the setting is off', async () => {
      await game.act('START_QUIZ');
      await advance(1); // -> round_intro

      expect(displayNote()).toBe('');
    });

    it('carries the note on the display view but never the players view while the setting is on', async () => {
      game = await harness.createGateway({
        joinCode: 'SHOWN1',
        rounds: [{ ...NOTED_QUIZ[0], showNoteOnScreen: true }],
      });
      await game.act('START_QUIZ');
      await advance(1); // -> round_intro

      expect(displayNote()).toBe(ROUND_NOTE);
      expect(playersCarryNote()).toBe(false);
    });

    it('carries the note on the break round intro', async () => {
      game = await harness.createGateway({
        joinCode: 'SHOWN2',
        rounds: [{ ...NOTED_QUIZ[0], showNoteOnScreen: true }],
      });
      await game.act('START_QUIZ');
      await advance(4); // -> break_intro
      await game.act('PREVIOUS');
      await game.act('PREVIOUS'); // -> break_round_intro

      expect(displayNote()).toBe(ROUND_NOTE);
    });

    it('carries no note on an open question or the reveal intro', async () => {
      game = await harness.createGateway({
        joinCode: 'SHOWN3',
        rounds: [{ ...NOTED_QUIZ[0], showNoteOnScreen: true }],
      });
      await game.act('START_QUIZ');
      await advance(2); // -> question open
      expect(displayNote()).toBe('');

      await advance(3); // -> reveal_intro
      expect(displayNote()).toBe('');
    });

    it('carries no note when the setting is on but the note is empty', async () => {
      game = await harness.createGateway({
        joinCode: 'SHOWN4',
        rounds: [{ ...NOTED_QUIZ[0], note: undefined, showNoteOnScreen: true }],
      });
      await game.act('START_QUIZ');
      await advance(1);

      expect(displayNote()).toBe('');
    });

    it('updates the display view when the setting is turned on while the intro is on air', async () => {
      await game.act('START_QUIZ');
      await advance(1); // -> round_intro
      expect(displayNote()).toBe('');

      await setShown(true);

      expect(displayNote()).toBe(ROUND_NOTE);
    });

    it('round-trips the setting through a saved draft', async () => {
      await setShown(true);

      const draft = await game.inRequestContext(() =>
        game.quizService.findDraftById(game.quizId),
      );
      expect(draft!.rounds[0].showNoteOnScreen).toBe(true);
    });
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
