import {
  UnknownLiveSessionError,
  type SettingsAndLeaguesUpdate,
} from '@/game/rest/live-session-rest.service';
import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';

describe('LiveSessionRest', () => {
  const harness = setupRealStoreGatewayTest();

  it('answers an unknown join code as unknown before it reads the request', async () => {
    const game = await harness.createGateway();
    const parseRequest = jest.fn(
      (): SettingsAndLeaguesUpdate => ({ partial: {}, leagueIds: undefined }),
    );

    await expect(
      game.rest.updateSettingsAndLeagues('NOPE12', parseRequest),
    ).rejects.toThrow(UnknownLiveSessionError);
    expect(parseRequest).not.toHaveBeenCalled();
  });

  it("tells the session's phones once an ended session is closed", async () => {
    const game = await harness.createGateway();
    // The default session is never evicted: a second one takes that role.
    await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    await game.act('START_QUIZ');
    await game.act('END_QUIZ');
    const notify = jest.spyOn(game.broadcaster, 'notifySessionClosed');

    await game.rest.closeSession(game.joinCode);

    expect(notify).toHaveBeenCalledWith(game.joinCode);
  });
});
