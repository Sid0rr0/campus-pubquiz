import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import {
  TEST_SESSION_TOKEN,
  createMockSocket,
  asSocket,
} from '@/game/__tests__/test-utils';
import { setupConcurrentSessionsTest } from '@/game/__tests__/concurrent-sessions-test-utils';

describe('GameGateway — concurrent sessions: roster, answer, and grading isolation', () => {
  const { state, openSessionA, createAndOpenSessionB } =
    setupConcurrentSessionsTest();

  it('keeps rosters, submitted answers, and grading fully isolated between two concurrently open sessions', async () => {
    await openSessionA();
    await createAndOpenSessionB();

    const playerA = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-a',
      'AAAAAA',
    );
    await state.gateway.handleConnection(asSocket(playerA));
    await state.gateway.handleJoinPlayers(asSocket(playerA), {
      teamName: 'Team Alpha',
      joinCode: 'AAAAAA',
    });

    const playerB = createMockSocket(
      SOCKET_ROOMS.PLAYERS,
      {},
      'player-b',
      'BBBBBB',
    );
    await state.gateway.handleConnection(asSocket(playerB));
    await state.gateway.handleJoinPlayers(asSocket(playerB), {
      teamName: 'Team Beta',
      joinCode: 'BBBBBB',
    });

    expect(state.gameStateService.getSnapshot('AAAAAA').teams).toEqual([
      expect.objectContaining({ teamId: 61, teamName: 'Team Alpha' }),
    ]);
    expect(state.gameStateService.getSnapshot('BBBBBB').teams).toEqual([
      expect.objectContaining({ teamId: 62, teamName: 'Team Beta' }),
    ]);

    await state.gateway.handleSubmitAnswer(asSocket(playerA), {
      questionId: 501,
      teamId: 61,
      value: 'foo',
    });
    await state.gateway.handleSubmitAnswer(asSocket(playerB), {
      questionId: 502,
      teamId: 62,
      value: 'bar',
    });

    expect(state.answerService.submit).toHaveBeenNthCalledWith(
      1,
      301,
      501,
      61,
      'foo',
    );
    expect(state.answerService.submit).toHaveBeenNthCalledWith(
      2,
      302,
      502,
      62,
      'bar',
    );
    expect(
      state.gameStateService.getSnapshot('AAAAAA').answeredTeamIds,
    ).toEqual([61]);
    expect(
      state.gameStateService.getSnapshot('BBBBBB').answeredTeamIds,
    ).toEqual([62]);

    const adminA = createMockSocket(
      SOCKET_ROOMS.ADMIN,
      { token: TEST_SESSION_TOKEN },
      'admin-grade-a',
      'AAAAAA',
    );
    await state.gateway.handleConnection(asSocket(adminA));
    await state.gateway.handleGradeAnswer(asSocket(adminA), {
      answerId: 701,
      pointsAwarded: 5,
    });

    // Only A was graded — its leaderboard is populated, B's is still empty.
    expect(state.gameStateService.getSnapshot('AAAAAA').leaderboard).toEqual([
      expect.objectContaining({ teamId: 61, teamName: 'Team Alpha' }),
    ]);
    expect(state.gameStateService.getSnapshot('BBBBBB').leaderboard).toEqual(
      [],
    );
  });
});
