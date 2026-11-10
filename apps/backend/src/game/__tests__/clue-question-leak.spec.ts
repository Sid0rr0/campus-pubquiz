import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type GameAction,
  type PresenterContextPayload,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const CLUES = ['Born in a tiny village', 'Wrote on relativity', 'E equals mc'];

// Screen-projection test: a Clue question's clues ride in `options`, and none
// may reach the display or the phones before it is shown; only the presenter
// remote's preview (admin room) carries them all.
describe('GameGateway — a Clue question shows its clues one at a time', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Who am I',
          breakAfter: true,
          questions: [
            {
              type: 'clues',
              prompt: 'Who am I?',
              answer: 'Einstein',
              points: 1.5,
              payload: { options: CLUES },
            },
            { type: 'free_text', prompt: 'Filler?', answer: 'Yes' },
          ],
        },
      ],
    });
  });

  const sentToScreensAndPhones = (): string => {
    const shared = [SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.PLAYERS].map((room) =>
      sessionRoom(game.joinCode, room),
    );
    return JSON.stringify(
      game
        .roomEmits()
        .filter(({ rooms }) => rooms.some((room) => shared.includes(room)))
        .map(({ payload }) => payload),
    );
  };

  const shownTo = (view: string): string[] =>
    CLUES.filter((clue) => view.includes(clue));

  const toTheQuestion: GameAction[] = ['START_QUIZ', 'ADVANCE', 'ADVANCE'];

  async function actAll(
    target: RealStoreGateway,
    actions: GameAction[],
  ): Promise<void> {
    for (const action of actions) await target.act(action);
  }

  it('opens on clue 1 and shows one more clue to the screens, phones and admin on each Advance', async () => {
    await actAll(game, toTheQuestion);
    expect(shownTo(sentToScreensAndPhones())).toEqual([CLUES[0]]);
    expect(shownTo(JSON.stringify(await game.snapshot()))).toEqual([CLUES[0]]);

    game.clearEmits();
    await game.act('ADVANCE');
    const view = await game.snapshot();
    expect(view.progress).toMatchObject({
      status: 'question_open',
      questionIndex: 0,
    });
    expect(shownTo(sentToScreensAndPhones())).toEqual(CLUES.slice(0, 2));
    expect(view.currentQuestion).toMatchObject({
      clues: CLUES.slice(0, 2),
      clueCount: 3,
    });
  });

  it('sends every clue to the presenter remote alone from clue 1, so the quiz master can read ahead', async () => {
    await actAll(game, toTheQuestion);

    const [context] = game
      .payloadsTo<PresenterContextPayload>(
        SOCKET_ROOMS.ADMIN,
        SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED,
      )
      .slice(-1);
    expect(context.currentScreen.question?.options).toEqual(CLUES);
    expect(shownTo(sentToScreensAndPhones())).toEqual([CLUES[0]]);
  });

  it('hides the latest clue on Previous and comes back to the highest clue shown', async () => {
    await actAll(game, [...toTheQuestion, 'ADVANCE', 'ADVANCE']); // clue 3
    await game.act('PREVIOUS'); // clue 2 on screen
    game.clearEmits();
    await game.act('PREVIOUS'); // clue 1 on screen
    expect(shownTo(sentToScreensAndPhones())).toEqual([CLUES[0]]);

    await game.act('PREVIOUS'); // clue 1: back to the round intro
    const advanced = await game.act('ADVANCE'); // and forward onto the question
    expect(advanced.progress.status).toBe('question_open');
    expect(advanced.currentQuestion).toMatchObject({ clues: CLUES });
  });

  it('keeps every clue out of the screens until it is shown, then sends all of them at the reveal', async () => {
    // Advance on the last clue moves on to the filler; locking, break and
    // reveal_intro follow. The clues never shown must stay unsent.
    await actAll(game, toTheQuestion);
    game.clearEmits();
    await actAll(game, [
      'ADVANCE', // clue 2
      'ADVANCE', // clue 3
      'ADVANCE', // filler
      'ADVANCE', // locking
      'ADVANCE', // break_intro
      'ADVANCE', // reveal_intro
    ]);
    await game.act('ADVANCE'); // reveal
    expect(shownTo(sentToScreensAndPhones())).toEqual(CLUES);
  });

  it('sends no clue past the one on air after Previous hides the latest', async () => {
    await actAll(game, [...toTheQuestion, 'ADVANCE', 'ADVANCE']); // clue 3
    game.clearEmits();
    await game.act('PREVIOUS');
    expect(shownTo(sentToScreensAndPhones())).toEqual(CLUES.slice(0, 2));
  });

  it('resumes the clue walk on the highest clue shown after a restart', async () => {
    await actAll(game, [...toTheQuestion, 'ADVANCE', 'ADVANCE']); // clue 3
    await game.act('PREVIOUS'); // clue 2 on screen, highest 3

    const restarted = await game.restart();
    const view = await restarted.snapshot();

    expect(view.currentQuestion).toMatchObject({ clues: CLUES });
    const next = await restarted.act('ADVANCE'); // the last clue: on to the filler
    expect(next.progress.questionIndex).toBe(1);
  });
});
