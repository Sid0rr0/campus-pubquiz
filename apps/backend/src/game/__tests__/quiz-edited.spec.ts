import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type AdminStatePayload,
  type LeaderboardEntry,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type CreateGatewayOptions,
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
    await game.saveAnswerKeyFix(game.questionIds.multipleChoice, {
      answer: 'London',
      points: 5,
    });

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
    await game.saveAnswerKeyFix(game.questionIds.multipleChoice, {
      answer: 'London',
      points: 5,
    });

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
    await game.saveQuizEdit();

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

const MIXED_BLOCK_QUIZ: CreateGatewayOptions['rounds'] = [
  {
    title: 'Mixed',
    breakAfter: true,
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 2,
        payload: { options: ['Paris', 'London'] },
      },
      {
        type: 'audio',
        prompt: 'Name that tune',
        answer: 'Queen',
        points: 3,
        payload: { mediaUrl: 'https://example.com/tune.mp3' },
      },
    ],
  },
];

describe('GameGateway — quiz edited, which teams and questions a key fix reaches', () => {
  const harness = setupRealStoreGatewayTest();

  function emitsTo(
    game: RealStoreGateway,
    room: string,
    event: string,
  ): RoomEmit[] {
    return game
      .roomEmits()
      .filter((emit) => emit.rooms.includes(room) && emit.event === event);
  }

  function submit(
    game: RealStoreGateway,
    team: { socket: MockSocket; teamId: number },
    questionId: number,
    value: string,
  ) {
    return game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value,
    });
  }

  function lastAdminView(game: RealStoreGateway): AdminStatePayload {
    const snapshots = game
      .payloadsTo<AdminStatePayload>(
        SOCKET_ROOMS.ADMIN,
        SOCKET_EVENTS.STATE_UPDATED,
      )
      .slice();
    return snapshots[snapshots.length - 1];
  }

  it('skips the sync for a team that answered and has disconnected, but still scores it', async () => {
    const game = await harness.createGateway({
      teamNames: ['Paris Fans', 'London Fans', 'Gone Fans'],
    });
    const admin = await game.connectAdmin();
    const [paris, london, gone] = game.teams;
    await game.openFirstQuestion(admin);
    for (const [team, value] of [
      [paris, 'Paris'],
      [london, 'London'],
      [gone, 'London'],
    ] as const) {
      await submit(game, team, game.questionIds.multipleChoice, value);
    }
    await game.gateway.handleDisconnect(asSocket(gone.socket));
    game.clearEmits();

    await game.saveAnswerKeyFix(game.questionIds.multipleChoice, {
      answer: 'London',
      points: 5,
    });

    expect(
      emitsTo(game, gone.socket.id, SOCKET_EVENTS.TEAM_ANSWERS_SYNCED),
    ).toHaveLength(0);
    for (const [team, points] of [
      [paris, 0],
      [london, 5],
    ] as const) {
      const syncs = emitsTo(
        game,
        team.socket.id,
        SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      );
      expect(syncs).toHaveLength(1);
      expect(
        (syncs[0].payload as { answers: { pointsAwarded: number | null }[] })
          .answers,
      ).toEqual([expect.objectContaining({ pointsAwarded: points })]);
    }
    const leaderboard = lastAdminView(game).leaderboard;
    expect(
      Object.fromEntries(
        leaderboard.map((entry) => [entry.teamId, entry.totalPoints]),
      ),
    ).toEqual({
      [paris.teamId]: 0,
      [london.teamId]: 5,
      [gone.teamId]: 5,
    });
  });

  it('refreshes both answer lists and syncs each answering team once when one save corrects an auto-graded and a typed question', async () => {
    const game = await harness.createGateway({
      teamNames: ['Tune Team', 'Abba Fan'],
      rounds: MIXED_BLOCK_QUIZ,
    });
    const admin = await game.connectAdmin();
    const [tune, abba] = game.teams;
    const [multipleChoice, audio] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, tune, multipleChoice, 'Paris');
    await submit(game, abba, multipleChoice, 'London');
    await game.act('ADVANCE'); // -> audio
    await submit(game, tune, audio, 'Queen'); // auto-graded under the old key
    await submit(game, abba, audio, 'Abba'); // waits for the quiz master
    expect(lastAdminView(game).ungradedQuestionIds).toEqual([audio]);
    game.clearEmits();

    await game.saveQuizEdit((rounds) =>
      rounds.map((round) => ({
        ...round,
        questions: round.questions.map((question) => {
          if (question.questionId === multipleChoice) {
            return { ...question, answer: 'London', points: 4 };
          }
          if (question.questionId === audio) {
            return { ...question, answer: 'Abba', points: 6 };
          }
          return question;
        }),
      })),
    );

    const answerLists = emitsTo(
      game,
      sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN),
      SOCKET_EVENTS.ANSWERS_UPDATED,
    ).map((emit) => emit.payload as { questionId: number });
    expect(answerLists.map((list) => list.questionId).sort()).toEqual(
      [multipleChoice, audio].sort(),
    );
    for (const [team, expected] of [
      [tune, { [multipleChoice]: 0, [audio]: 0 }],
      [abba, { [multipleChoice]: 4, [audio]: 6 }],
    ] as const) {
      const syncs = emitsTo(
        game,
        team.socket.id,
        SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
      );
      expect(syncs).toHaveLength(1);
      const answers = (
        syncs[0].payload as {
          answers: { questionId: number; pointsAwarded: number | null }[];
        }
      ).answers;
      expect(
        Object.fromEntries(
          answers.map((answer) => [answer.questionId, answer.pointsAwarded]),
        ),
      ).toEqual(expected);
    }
    // Tune Team's audio answer matched the old key only, so it is ungraded again.
    const fromDatabase = await game.inRequestContext(() =>
      game.answerService.listUngradedQuestionIds(game.gameSessionId, [
        multipleChoice,
        audio,
      ]),
    );
    expect(fromDatabase).toEqual([audio]);
    expect([...lastAdminView(game).ungradedQuestionIds]).toEqual(fromDatabase);
  });
});
