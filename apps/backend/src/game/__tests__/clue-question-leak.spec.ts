import {
  SOCKET_ROOMS,
  sessionRoom,
  type GameAction,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const CLUES = ['Born in a tiny village', 'Wrote on relativity', 'E equals mc'];

// Screen-projection test: a Clue question's clues ride in `options`, and none
// may reach the display, the phones or the admin before the reveal.
describe('GameGateway — a Clue question never leaks a clue before the reveal', () => {
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

  it('keeps every clue out of the display, the phones and the admin until the reveal, then sends them all', async () => {
    // The admin's view of a locked block carries its revealed questions
    // untrimmed, so the admin is checked while the block is still being asked.
    const whileAsking: GameAction[] = [
      'START_QUIZ',
      'ADVANCE', // round_intro
      'ADVANCE', // the Clue question
      'ADVANCE', // filler
    ];
    const afterAsking: GameAction[] = [
      'ADVANCE', // locking
      'ADVANCE', // break_intro
      'ADVANCE', // reveal_intro
    ];
    for (const [step, action] of [...whileAsking, ...afterAsking].entries()) {
      await game.act(action);
      const toScreens = sentToScreensAndPhones();
      for (const clue of CLUES) expect(toScreens).not.toContain(clue);
      if (step < whileAsking.length) {
        const toAdmin = JSON.stringify(await game.snapshot());
        for (const clue of CLUES) expect(toAdmin).not.toContain(clue);
      }
      game.clearEmits();
    }

    await game.act('ADVANCE'); // reveal
    const atReveal = sentToScreensAndPhones();
    for (const clue of CLUES) expect(atReveal).toContain(clue);
  });
});
