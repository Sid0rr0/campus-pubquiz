import { SOCKET_ROOMS, type DisplayScreen } from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

type ScreenKind = DisplayScreen['kind'];

/** The kinds the Quiz preview's "like the night" order keeps. */
const NIGHT_KINDS: readonly ScreenKind[] = [
  'round_overview',
  'round_title',
  'question',
  'break_intro',
  'reveal_intro',
  'reveal',
];

/** Kinds a real run passes through that the preview leaves out. */
const NEVER_IN_PREVIEW: readonly ScreenKind[] = [
  'lobby',
  'rules',
  'locking',
  'leaderboard',
];

const free = (prompt: string) => ({
  type: 'free_text' as const,
  prompt,
  answer: 'x',
  points: 1,
});

const PLAIN: QuizRoundSpec = {
  title: 'Plain',
  breakAfter: true,
  questions: [
    free('Plain one?'),
    {
      type: 'closest_guess',
      prompt: 'How many?',
      answer: '206',
      points: 3,
    },
  ],
};
const KAHOOT: QuizRoundSpec = {
  title: 'Kahoot',
  breakAfter: true,
  kahootMode: true,
  questions: [
    {
      type: 'multiple_choice',
      prompt: 'Pick one?',
      answer: 'A',
      points: 2,
      payload: { options: ['A', 'B'] },
    },
    free('Kahoot two?'),
  ],
};
const NO_BREAK: QuizRoundSpec = {
  title: 'No break',
  breakAfter: false,
  questions: [free('No break?')],
};
const LAST: QuizRoundSpec = {
  title: 'Last',
  breakAfter: true,
  questions: [free('Last?')],
};

/** Start quiz, then Advance to the end, reading the display screen kind after each press. */
async function liveRun(game: RealStoreGateway): Promise<ScreenKind[]> {
  const kinds: ScreenKind[] = [
    (await game.resync(SOCKET_ROOMS.DISPLAY)).screen.kind,
  ];
  await game.act('START_QUIZ');
  for (let press = 0; press < 200; press += 1) {
    const view = await game.resync(SOCKET_ROOMS.DISPLAY);
    kinds.push(view.screen.kind);
    if (view.progress.status === 'ended') return kinds;
    await game.act('ADVANCE');
  }
  throw new Error('The live run never ended');
}

async function previewKinds(game: RealStoreGateway): Promise<ScreenKind[]> {
  const preview = await game.inRequestContext(() =>
    game.quizPreviewService.preview(game.quizId, 'night'),
  );
  return preview.steps.map(({ screen }) => screen.kind);
}

describe('Quiz preview vs a real session', () => {
  const harness = setupRealStoreGatewayTest();
  const settings = { funFactsEnabled: false, showRoundOverview: true };

  it('shows exactly the screen kinds a real session reaches by Advance, minus the left-out kinds', async () => {
    const game = await harness.createGateway({
      rounds: [PLAIN, KAHOOT, NO_BREAK, LAST],
      settings,
    });

    const live = await liveRun(game);
    const preview = await previewKinds(game);

    expect(preview).toEqual(live.filter((kind) => NIGHT_KINDS.includes(kind)));
    // The run really passed through kinds the preview leaves out.
    const leftOut = NEVER_IN_PREVIEW.filter((kind) => live.includes(kind));
    expect(leftOut).toEqual(NEVER_IN_PREVIEW);
  });
});
