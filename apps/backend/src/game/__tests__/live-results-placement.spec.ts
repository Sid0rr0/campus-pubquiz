import { Logger } from '@nestjs/common';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { LeagueTableService } from '@/league/league-table.service';
import { StandingsService } from '@/standings/standings.service';

describe('Live session — placement and the live results read', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function totalPoints(view: { leaderboard: { totalPoints: number }[] }) {
    return view.leaderboard.reduce((sum, entry) => sum + entry.totalPoints, 0);
  }

  it('creates a session with an empty board when the leaderboard read fails, and the first graded answer then appears on it', async () => {
    jest
      .spyOn(game.standingsService, 'leaderboard')
      .mockRejectedValueOnce(new Error('standings unavailable'));

    const { joinCode } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    expect((await game.snapshot(joinCode)).leaderboard).toEqual([]);

    const admin = await game.connectAdmin(joinCode);
    const team = await game.joinTeam('Late Starters', joinCode);
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'START_QUIZ',
    });
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'Paris',
    });

    const board = (await game.snapshot(joinCode)).leaderboard;
    expect(board.map((entry) => entry.teamId)).toEqual([team.teamId]);
    expect(totalPoints({ leaderboard: board })).toBe(2);
  });

  it('restores a session at its saved position when a standings read fails, and the next write brings the figures back', async () => {
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);
    const team = game.teams[0];
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'Paris',
    });
    const before = await game.snapshot();
    expect(totalPoints(before)).toBe(2);

    jest
      .spyOn(StandingsService.prototype, 'leaderboard')
      .mockRejectedValueOnce(new Error('standings unavailable'));
    jest
      .spyOn(StandingsService.prototype, 'verdictTallies')
      .mockRejectedValueOnce(new Error('tallies unavailable'));
    jest
      .spyOn(StandingsService.prototype, 'funFactData')
      .mockRejectedValueOnce(new Error('fun facts unavailable'));
    const restarted = await game.restart();

    const restored = await restarted.snapshot();
    expect(restored.progress).toEqual(before.progress);
    expect(restored.leaderboard).toEqual([]);

    const readAfter = jest.spyOn(restarted.standingsService, 'funFactData');
    const adminAfter = await restarted.connectAdmin();
    await restarted.gateway.handleAwardBonus(asSocket(adminAfter), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    expect(totalPoints(await restarted.snapshot())).toBe(3);
    expect(readAfter).toHaveBeenCalled();
  });

  it('reads the league top at creation and restart, never on an answer, a grade or a bonus', async () => {
    const readTop = jest.spyOn(LeagueTableService.prototype, 'topFor');
    await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    expect(readTop).toHaveBeenCalledTimes(1);

    readTop.mockClear();
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);
    const team = game.teams[0];
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'Paris',
    });
    await game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });
    await game.act('ADVANCE');
    expect(readTop).not.toHaveBeenCalled();

    await game.restart();
    expect(readTop).toHaveBeenCalled();
  });
});
