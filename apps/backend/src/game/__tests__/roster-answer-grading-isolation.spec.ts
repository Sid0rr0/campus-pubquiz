import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — concurrent sessions: roster, answer, and grading isolation', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let questionId: number;

  beforeEach(async () => {
    // A single human-graded question, so grading is the admin's call.
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Round Alpha',
          breakAfter: true,
          questions: [
            {
              type: 'audio',
              prompt: 'Name that tune',
              answer: 'Queen',
              points: 7,
            },
          ],
        },
      ],
    });
    [questionId] = game.rounds[0].questionIds;
  });

  it('keeps rosters, submitted answers, and grading fully isolated between two concurrently open sessions', async () => {
    const adminA = await game.connectAdmin();
    await game.openFirstQuestion(adminA);
    const { joinCode: joinCodeB } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const adminB = await game.connectAdmin(joinCodeB);
    await game.openFirstQuestion(adminB);

    const alpha = await game.joinTeam('Team Alpha');
    const beta = await game.joinTeam('Team Beta', joinCodeB);

    expect((await game.snapshot()).teams).toEqual([
      expect.objectContaining({ teamId: alpha.teamId, teamName: 'Team Alpha' }),
    ]);
    expect((await game.snapshot(joinCodeB)).teams).toEqual([
      expect.objectContaining({ teamId: beta.teamId, teamName: 'Team Beta' }),
    ]);

    // Same quiz, so the same question id: each submit still lands only in its own session.
    for (const [team, value] of [
      [alpha, 'foo'],
      [beta, 'bar'],
    ] as const) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId,
        teamId: team.teamId,
        value,
      });
    }

    expect((await game.snapshot()).answeredTeamIds).toEqual([alpha.teamId]);
    expect((await game.snapshot(joinCodeB)).answeredTeamIds).toEqual([
      beta.teamId,
    ]);
    const answersInA = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    expect(answersInA).toEqual([
      expect.objectContaining({ teamName: 'Team Alpha', value: 'foo' }),
    ]);

    await game.gateway.handleGradeAnswer(asSocket(adminA), {
      answerId: answersInA[0].answerId,
      pointsAwarded: 5,
    });

    // Each session's leaderboard holds only its own team — grading A's
    // answer never puts Team Alpha on B's board or points on Team Beta.
    expect((await game.snapshot()).leaderboard).toEqual([
      expect.objectContaining({
        teamId: alpha.teamId,
        teamName: 'Team Alpha',
        totalPoints: 5,
      }),
    ]);
    expect((await game.snapshot(joinCodeB)).leaderboard).toEqual([
      expect.objectContaining({
        teamId: beta.teamId,
        teamName: 'Team Beta',
        totalPoints: 0,
      }),
    ]);
  });
});
