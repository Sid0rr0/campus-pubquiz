import { SOCKET_EVENTS, type AdminStatePayload } from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Music',
    questions: [
      {
        type: 'free_text',
        prompt: 'Name this tune.',
        answer: 'Thriller',
        points: 1,
        payload: { mediaUrl: 'https://example.com/tune.mp3' },
      },
    ],
  },
];

/**
 * Whether a media clip is paused is not stored: a restarted backend rebuilds
 * it from the Autoplay media setting, or a display that stays connected would
 * start a clip nobody pressed Play on.
 */
describe('GameGateway — a restored session and its media pause', () => {
  const harness = setupRealStoreGatewayTest();

  async function viewAfterRestart(
    game: RealStoreGateway,
  ): Promise<AdminStatePayload> {
    const restarted = await game.restart();
    const admin = await restarted.connectAdmin();
    const sync = admin.emit.mock.calls.find(
      ([event]) => event === SOCKET_EVENTS.STATE_SYNC,
    ) as [string, AdminStatePayload] | undefined;
    if (!sync) throw new Error('The admin received no snapshot');
    return sync[1];
  }

  it('comes back paused when the session does not autoplay', async () => {
    const game = await harness.createGateway({
      rounds: ROUNDS,
      settings: { autoplayMedia: false },
    });
    await game.openFirstQuestion(await game.connectAdmin());

    const view = await viewAfterRestart(game);

    expect(view.progress.status).toBe('question_open');
    expect(view.progress.isMediaPaused).toBe(true);
  });

  it('comes back playing when the session autoplays', async () => {
    const game = await harness.createGateway({ rounds: ROUNDS });
    await game.openFirstQuestion(await game.connectAdmin());

    const view = await viewAfterRestart(game);

    expect(view.progress.isMediaPaused).toBeFalsy();
  });
});
