import { RequestContext } from '@mikro-orm/postgresql';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type LeaderboardEntry,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
  type RoomEmit,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — quiz edited (live answer-key fix)', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let parisTeam: { socket: MockSocket; teamId: number };
  let londonTeam: { socket: MockSocket; teamId: number };

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['Paris Fans', 'London Fans'],
    });
    admin = await game.connectAdmin();
    [parisTeam, londonTeam] = game.teams;
    await game.openFirstQuestion(admin);
    for (const [team, value] of [
      [parisTeam, 'Paris'],
      [londonTeam, 'London'],
    ] as const) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId: game.questionIds.multipleChoice,
        teamId: team.teamId,
        value,
      });
    }
    game.clearEmits();
  });

  async function correctAnswerKey(answer: string, points: number) {
    await game.inRequestContext(async () => {
      const em = RequestContext.getEntityManager()!;
      const question = await em.findOneOrFail(Question, {
        id: game.questionIds.multipleChoice,
      });
      question.answer = answer;
      question.points = points;
      await em.flush();
    });
  }

  // QuizController.update calls notifyQuizEdited inside an HTTP request context.
  function editQuiz(regradeQuestionIds: number[]) {
    return game.inRequestContext(() =>
      game.gateway.notifyQuizEdited(game.joinCode, regradeQuestionIds),
    );
  }

  function emitsTo(room: string, event: string): RoomEmit[] {
    return game
      .roomEmits()
      .filter((emit) => emit.rooms.includes(room) && emit.event === event);
  }

  function lastLeaderboard(): LeaderboardEntry[] {
    const snapshots = emitsTo(
      sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN),
      SOCKET_EVENTS.STATE_UPDATED,
    ).map((emit) => emit.payload as StateSnapshotPayload);
    return snapshots[snapshots.length - 1].leaderboard;
  }

  it('sends the admin room the re-scored answer list of a corrected shown question', async () => {
    await correctAnswerKey('London', 5);

    await editQuiz([game.questionIds.multipleChoice]);

    const [update] = emitsTo(
      sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN),
      SOCKET_EVENTS.ANSWERS_UPDATED,
    );
    const answers = (
      update.payload as {
        answers: { teamId: number; pointsAwarded: number | null }[];
      }
    ).answers;
    expect(
      answers.find((answer) => answer.teamId === londonTeam.teamId),
    ).toMatchObject({ pointsAwarded: 5 });
    expect(
      answers.find((answer) => answer.teamId === parisTeam.teamId),
    ).toMatchObject({ pointsAwarded: 0 });
  });

  it('syncs each answering team its re-scored answer and refreshes the leaderboard', async () => {
    await correctAnswerKey('London', 5);

    await editQuiz([game.questionIds.multipleChoice]);

    for (const [team, points] of [
      [londonTeam, 5],
      [parisTeam, 0],
    ] as const) {
      const [sync] = emitsTo(team.socket.id, SOCKET_EVENTS.TEAM_ANSWERS_SYNCED);
      expect(
        (sync.payload as { answers: { pointsAwarded: number | null }[] })
          .answers,
      ).toEqual([expect.objectContaining({ pointsAwarded: points })]);
    }
    expect(lastLeaderboard()).toEqual([
      expect.objectContaining({ teamId: londonTeam.teamId, totalPoints: 5 }),
      expect.objectContaining({ teamId: parisTeam.teamId, totalPoints: 0 }),
    ]);
  });

  it('only reloads and broadcasts when no shown question was corrected', async () => {
    await editQuiz([]);

    expect(
      emitsTo(
        sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN),
        SOCKET_EVENTS.STATE_UPDATED,
      ),
    ).toHaveLength(1);
    const events = game.roomEmits().map((emit) => emit.event);
    expect(events).not.toContain(SOCKET_EVENTS.ANSWERS_UPDATED);
    expect(events).not.toContain(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED);
  });
});
