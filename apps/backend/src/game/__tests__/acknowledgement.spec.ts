import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const SUCCESS = { success: true };

describe('GameGateway — acknowledgement on success', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  it('acknowledges ADMIN_ACTION, JOIN_PLAYERS and SET_* admin events', async () => {
    game = await harness.createGateway();
    const admin = await game.connectAdmin();
    const player = await game.connectPlayer();

    await expect(
      game.gateway.handleAdminAction(asSocket(admin), {
        action: 'START_QUIZ',
      }),
    ).resolves.toEqual(SUCCESS);
    await expect(
      game.gateway.handleJoinPlayers(asSocket(player), {
        teamName: 'Quiz',
        joinCode: game.joinCode,
      }),
    ).resolves.toEqual(SUCCESS);
    await expect(
      game.gateway.handleSetBreakEndTime(asSocket(admin), {
        breakEndsAt: null,
      }),
    ).resolves.toEqual(SUCCESS);
    await expect(
      game.gateway.handleSetDisplayTextScale(asSocket(admin), {
        displayTextScale: 1.5,
      }),
    ).resolves.toEqual(SUCCESS);
  });

  it('acknowledges SUBMIT_ANSWER, GRADE_ANSWER, AWARD_BONUS, LEAVE_SESSION and KICK_TEAM', async () => {
    game = await harness.createGateway({
      teamNames: ['Leaver', 'Kicked', 'Answerer'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'audio', prompt: 'Band?', answer: 'Queen', points: 2 },
          ],
        },
      ],
    });
    const admin = await game.connectAdmin();
    const [leaver, kicked, answerer] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);

    await expect(
      game.gateway.handleSubmitAnswer(asSocket(answerer.socket), {
        questionId,
        teamId: answerer.teamId,
        value: 'Abba',
      }),
    ).resolves.toEqual(SUCCESS);
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    await expect(
      game.gateway.handleGradeAnswer(asSocket(admin), {
        answerId: answer.answerId,
        pointsAwarded: 1,
      }),
    ).resolves.toEqual(SUCCESS);
    await expect(
      game.gateway.handleAwardBonus(asSocket(admin), {
        teamId: answerer.teamId,
        category: 'shot',
        points: 1,
      }),
    ).resolves.toEqual(SUCCESS);
    await expect(
      game.gateway.handleLeaveSession(asSocket(leaver.socket), {
        teamId: leaver.teamId,
      }),
    ).resolves.toEqual(SUCCESS);
    await expect(
      game.gateway.handleKickTeam(asSocket(admin), { teamId: kicked.teamId }),
    ).resolves.toEqual(SUCCESS);
  });

  it('acknowledges CREATE_SHOWDOWN_ROUND and SUBMIT_SHOWDOWN_GUESS', async () => {
    game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
    await tieOnFirstQuestion(game, game.teams);
    const admin = await game.connectAdmin();

    await expect(
      game.gateway.handleCreateShowdownRound(asSocket(admin), {
        question: 'How many?',
        answer: '100',
        points: 5,
      }),
    ).resolves.toEqual(SUCCESS);
    const { activeShowdown } = await game.snapshot();
    const [teamA] = game.teams;

    await expect(
      game.gateway.handleSubmitShowdownGuess(asSocket(teamA.socket), {
        showdownRoundId: activeShowdown!.id,
        teamId: teamA.teamId,
        value: '95',
      }),
    ).resolves.toEqual(SUCCESS);
  });
});
