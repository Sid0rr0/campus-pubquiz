import { Logger } from '@nestjs/common';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { LeagueTableService } from '@/league/league-table.service';
import { StandingsService } from '@/standings/standings.service';

const ONE_BLOCK: QuizRoundSpec[] = [
  {
    title: 'Only round',
    breakAfter: true,
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Pick the right one',
        answer: 'right',
        points: 2,
        payload: { options: ['right', 'wrong'] },
      },
    ],
  },
];

describe('Live session — placement and the live results read', () => {
  const harness = setupRealStoreGatewayTest();

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function totalPoints(view: { leaderboard: { totalPoints: number }[] }) {
    return view.leaderboard.reduce((sum, entry) => sum + entry.totalPoints, 0);
  }

  it('creates a session with an empty board when the leaderboard read fails, and the first graded answer then appears on it', async () => {
    const game: RealStoreGateway = await harness.createGateway({
      teamNames: ['The Quizzards'],
    });
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
    const oneBlock = await harness.createGateway({
      rounds: ONE_BLOCK,
      teamNames: ['The Quizzards'],
    });
    await oneBlock.act('START_QUIZ');
    await oneBlock.act('ADVANCE');
    await oneBlock.act('ADVANCE');
    const team = oneBlock.teams[0];
    await oneBlock.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: oneBlock.rounds[0].questionIds[0],
      teamId: team.teamId,
      value: 'right',
    });
    const before = await oneBlock.snapshot();
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
    const restarted = await oneBlock.restart();

    const restored = await restarted.snapshot();
    expect(restored.progress).toEqual(before.progress);
    expect(restored.leaderboard).toEqual([]);

    const adminAfter = await restarted.connectAdmin();
    await restarted.gateway.handleAwardBonus(asSocket(adminAfter), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });

    expect(totalPoints(await restarted.snapshot())).toBe(3);

    // The fun fact data came back: the break shows the bonus award.
    await restarted.act('ADVANCE');
    await restarted.act('ADVANCE');
    const breakView = await restarted.resync('display');
    expect(breakView.screen.kind).toBe('break_intro');
    expect(
      breakView.screen.kind === 'break_intro' && breakView.screen.funFacts,
    ).toContainEqual(expect.objectContaining({ kind: 'bonus_awards_so_far' }));

    // The verdict tallies came back: the reveal counts the correct team.
    await restarted.act('ADVANCE');
    await restarted.act('ADVANCE');
    expect((await restarted.resync('display')).teamsCorrect).toEqual({
      correct: 1,
      partial: 0,
      teamCount: 1,
    });
  });

  it('reads the league top at creation and restart, never on an answer, a grade or a bonus', async () => {
    const oneBlock = await harness.createGateway({
      rounds: ONE_BLOCK,
      teamNames: ['The Quizzards'],
    });
    const readTop = jest.spyOn(LeagueTableService.prototype, 'topFor');
    await oneBlock.inRequestContext(() =>
      oneBlock.gameState.createSession(oneBlock.quizId),
    );
    expect(readTop).toHaveBeenCalledTimes(1);

    readTop.mockClear();
    await oneBlock.act('START_QUIZ');
    await oneBlock.act('ADVANCE');
    await oneBlock.act('ADVANCE');
    const team = oneBlock.teams[0];
    await oneBlock.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: oneBlock.rounds[0].questionIds[0],
      teamId: team.teamId,
      value: 'right',
    });
    const admin = await oneBlock.connectAdmin();
    await oneBlock.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });
    // Lock the block, then the move into the break grades it.
    await oneBlock.act('ADVANCE');
    await oneBlock.act('ADVANCE');
    expect((await oneBlock.snapshot()).progress.status).toBe('break_intro');
    expect(readTop).not.toHaveBeenCalled();

    await oneBlock.restart();
    expect(readTop).toHaveBeenCalled();
  });
});
