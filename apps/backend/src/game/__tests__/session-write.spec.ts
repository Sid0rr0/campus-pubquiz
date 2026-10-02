import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type LeaderboardEntry,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  type JoinedTeam,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — session write: bonus changes', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let teamId: number;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    teamId = game.teams[0].teamId;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function adminSnapshots(joinCode = game.joinCode): StateSnapshotPayload[] {
    const adminRoom = sessionRoom(joinCode, SOCKET_ROOMS.ADMIN);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
  }

  function bonusIn(snapshot: StateSnapshotPayload): number | undefined {
    return snapshot.leaderboard.find(
      (entry: LeaderboardEntry) => entry.teamId === teamId,
    )?.bonusPoints;
  }

  function award(points: number, socket = admin, forTeam = teamId) {
    return game.gateway.handleAwardBonus(asSocket(socket), {
      teamId: forTeam,
      category: 'shot',
      points,
    });
  }

  // Gives the second award time to be stored and (on code without a session
  // write) have its own standings read finish, so it is the older read that
  // lands last.
  async function secondAwardStored(): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const awards = await game.inRequestContext(() =>
        game.bonusService.listForTeamAdmin(game.gameSessionId, teamId),
      );
      if (awards.length === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  it('ends with both awards on the leaderboard when the first award’s standings read finishes last', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');

    const first = award(1);
    await held.started;
    const second = award(2);
    await secondAwardStored();
    held.release();
    await Promise.all([first, second]);

    const snapshots = adminSnapshots();
    expect(bonusIn(snapshots[snapshots.length - 1])).toBe(3);
    const totals = snapshots.map((snapshot) => bonusIn(snapshot) ?? 0);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('does not make one session’s held bonus write delay a bonus write in another session', async () => {
    const { joinCode: otherCode } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const otherAdmin = await game.connectAdmin(otherCode);
    const other = await game.joinTeam('Other Team', otherCode);
    game.clearEmits();

    const held = holdNextCall(game.standingsService, 'leaderboard');
    const blocked = award(1);
    await held.started;

    await award(2, otherAdmin, other.teamId);

    const otherSnapshots = adminSnapshots(otherCode);
    expect(
      otherSnapshots[otherSnapshots.length - 1].leaderboard.find(
        (entry) => entry.teamId === other.teamId,
      )?.bonusPoints,
    ).toBe(2);
    held.release();
    await blocked;
  });

  it('leaves the session unchanged when a bonus write fails, returns the error, and still applies the next change', async () => {
    jest
      .spyOn(game.standingsService, 'leaderboard')
      .mockRejectedValueOnce(new Error('standings unavailable'));
    const before = await game.snapshot();

    await expect(award(1)).resolves.toEqual({
      success: false,
      error: 'Internal server error',
    });
    expect((await game.snapshot()).leaderboard).toEqual(before.leaderboard);

    game.clearEmits();
    await award(2);

    const snapshots = adminSnapshots();
    // Both awards are stored; the failed one's points show once standings are re-read.
    expect(bonusIn(snapshots[snapshots.length - 1])).toBe(3);
  });
});

describe('GameGateway — session write: answers recorded and graded', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let teamA: JoinedTeam;
  let teamB: JoinedTeam;

  beforeEach(async () => {
    game = await harness.createGateway({
      teamNames: ['The Quizzards', 'Bystanders'],
    });
    admin = await game.connectAdmin();
    [teamA, teamB] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function adminSnapshots(): StateSnapshotPayload[] {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
  }

  function lastAdminSnapshot(): StateSnapshotPayload {
    const snapshots = adminSnapshots();
    return snapshots[snapshots.length - 1];
  }

  function submit(team: JoinedTeam, questionId: number, value: string) {
    return game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value,
    });
  }

  function grade(answerId: number, pointsAwarded: number) {
    return game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded,
    });
  }

  async function advanceToFreeText(): Promise<number> {
    await game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    game.clearEmits();
    return game.questionIds.freeText;
  }

  async function ungradedAnswerIds(questionId: number): Promise<number[]> {
    const answers = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    return answers.map((answer) => answer.answerId);
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

  function totalPoints(snapshot: StateSnapshotPayload): number {
    return snapshot.leaderboard.reduce(
      (sum, entry) => sum + entry.totalPoints,
      0,
    );
  }

  it('ends with both grades on the leaderboard when the first grade’s standings read finishes last', async () => {
    const questionId = await advanceToFreeText();
    await submit(teamA, questionId, 'Saturn');
    await submit(teamB, questionId, 'Mars');
    const [firstAnswer, secondAnswer] = await ungradedAnswerIds(questionId);
    game.clearEmits();

    const held = holdNextCall(game.standingsService, 'leaderboard');
    const first = grade(firstAnswer, 1);
    await held.started;
    const second = grade(secondAnswer, 2);
    await settle();
    held.release();
    await Promise.all([first, second]);

    expect(totalPoints(lastAdminSnapshot())).toBe(3);
  });

  it('shows both teams as answered when the first answer’s answered-teams read finishes last', async () => {
    const questionId = game.questionIds.multipleChoice;

    const held = holdNextCall(game.answerService, 'listForQuestion');
    const first = submit(teamA, questionId, 'Paris');
    await held.started;
    const second = submit(teamB, questionId, 'Paris');
    await settle();
    held.release();
    await Promise.all([first, second]);

    expect([...lastAdminSnapshot().answeredTeamIds].sort()).toEqual(
      [teamA.teamId, teamB.teamId].sort(),
    );
  });

  it('clears the ungraded marker when the last waiting answer is graded while another grade overlaps', async () => {
    const questionId = await advanceToFreeText();
    await submit(teamA, questionId, 'Saturn');
    await submit(teamB, questionId, 'Mars');
    const [firstAnswer, secondAnswer] = await ungradedAnswerIds(questionId);
    expect(lastAdminSnapshot().ungradedQuestionIds).toEqual([questionId]);

    const held = holdNextCall(game.answerService, 'listUngradedQuestionIds');
    const first = grade(firstAnswer, 1);
    await held.started;
    const second = grade(secondAnswer, 0);
    await settle();
    held.release();
    await Promise.all([first, second]);

    expect(lastAdminSnapshot().ungradedQuestionIds).toEqual([]);
  });
});

describe('GameGateway — session write: roster changes', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let kicked: JoinedTeam;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['Kicked Team'] });
    admin = await game.connectAdmin();
    [kicked] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  function lastAdminSnapshot(): StateSnapshotPayload {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
    return snapshots[snapshots.length - 1];
  }

  function kick(teamId: number) {
    return game.gateway.handleKickTeam(asSocket(admin), { teamId });
  }

  async function startJoin(teamName: string): Promise<{
    joined: Promise<unknown>;
    socket: MockSocket;
  }> {
    const socket = await game.connectPlayer();
    const joined = game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName,
      joinCode: game.joinCode,
    });
    return { joined, socket };
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

  it('ends with the joined team connected and the kicked team gone when the kick’s standings read finishes last', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const kicking = kick(kicked.teamId);
    await held.started;

    const { joined } = await startJoin('Newcomers');
    await settle();
    held.release();
    await Promise.all([kicking, joined]);

    const snapshot = lastAdminSnapshot();
    const newcomer = snapshot.teams.find(
      (team) => team.teamName === 'Newcomers',
    );
    expect(newcomer?.isConnected).toBe(true);
    expect(
      snapshot.leaderboard.find((entry) => entry.teamId === newcomer?.teamId)
        ?.totalPoints,
    ).toBe(0);
    expect(snapshot.teams.map((team) => team.teamId)).not.toContain(
      kicked.teamId,
    );
    expect(snapshot.leaderboard.map((entry) => entry.teamId)).not.toContain(
      kicked.teamId,
    );
  });

  it('shows a team that joins while a bonus write is held as connected once both finish', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: kicked.teamId,
      category: 'shot',
      points: 1,
    });
    await held.started;

    const { joined } = await startJoin('Latecomers');
    await settle();
    held.release();
    await Promise.all([awarding, joined]);

    const snapshot = lastAdminSnapshot();
    expect(
      snapshot.teams.find((team) => team.teamName === 'Latecomers')
        ?.isConnected,
    ).toBe(true);
    expect(
      snapshot.leaderboard.find((entry) => entry.teamId === kicked.teamId)
        ?.bonusPoints,
    ).toBe(1);
  });

  it('sends TEAM_KICKED exactly once to a kicked team that still had a socket', async () => {
    await kick(kicked.teamId);

    const kickedNotices = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(kicked.socket.id) &&
          emit.event === SOCKET_EVENTS.TEAM_KICKED,
      );
    expect(kickedNotices).toHaveLength(1);
  });
});

describe('GameGateway — session write: presses', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let team: JoinedTeam;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    admin = await game.connectAdmin();
    [team] = game.teams;
    await game.openFirstQuestion(admin);
    game.clearEmits();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function lastAdminSnapshot(): StateSnapshotPayload {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as StateSnapshotPayload);
    return snapshots[snapshots.length - 1];
  }

  function press() {
    return game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

  it('keeps an answer submitted while an Advance waits on its progress save', async () => {
    const questionId = game.questionIds.multipleChoice;
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press();
    await held.started;

    const submitting = game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value: 'Paris',
    });
    await settle();
    held.release();
    await Promise.all([pressing, submitting]);
    // The press moved on to the next question; step back to read this one's marker.
    await game.act('PREVIOUS');

    expect(lastAdminSnapshot().answeredTeamIds).toContain(team.teamId);
    const answers = game
      .payloadsTo<{
        questionId: number;
        answers: unknown[];
      }>(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED)
      .filter((payload) => payload.questionId === questionId);
    expect(answers[answers.length - 1].answers).toHaveLength(1);
  });

  it('shows a team that joins while a press waits on its save as connected and on the leaderboard', async () => {
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press();
    await held.started;

    const socket = await game.connectPlayer();
    const joining = game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'Latecomers',
      joinCode: game.joinCode,
    });
    await settle();
    held.release();
    await Promise.all([pressing, joining]);

    const snapshot = lastAdminSnapshot();
    const latecomer = snapshot.teams.find(
      (entry) => entry.teamName === 'Latecomers',
    );
    expect(latecomer?.isConnected).toBe(true);
    expect(snapshot.leaderboard.map((entry) => entry.teamId)).toContain(
      latecomer?.teamId,
    );
  });

  it('removes a team kicked during a press from the roster and leaderboard for good', async () => {
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press();
    await held.started;

    const kicking = game.gateway.handleKickTeam(asSocket(admin), {
      teamId: team.teamId,
    });
    await settle();
    held.release();
    await Promise.all([pressing, kicking]);

    const snapshot = await game.snapshot();
    expect(snapshot.teams.map((entry) => entry.teamId)).not.toContain(
      team.teamId,
    );
    expect(snapshot.leaderboard.map((entry) => entry.teamId)).not.toContain(
      team.teamId,
    );
  });

  it('reports a failed progress save and still lands the next answer', async () => {
    jest
      .spyOn(game.progressRepository, 'save')
      .mockRejectedValueOnce(new Error('database is down'));

    await expect(press()).resolves.toMatchObject({ success: false });
    game.clearEmits();
    await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId: game.questionIds.multipleChoice,
      teamId: team.teamId,
      value: 'Paris',
    });

    expect(lastAdminSnapshot().answeredTeamIds).toContain(team.teamId);
  });
});

describe('GameGateway — session write: a refused press', () => {
  const harness = setupRealStoreGatewayTest();

  it('reports its refusal, lets the grade land and leaves the session in the break', async () => {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'audio', prompt: 'Name that tune', answer: 'Queen' },
          ],
        },
      ],
    });
    const admin = await game.connectAdmin();
    const [{ socket, teamId }] = game.teams;
    const questionId = game.rounds[0].questionIds[0];
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action);
    }
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value: 'Banana',
    });
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> break_intro
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );

    const refused = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    const graded = game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });
    const [pressResult] = await Promise.all([refused, graded]);

    expect(pressResult).toMatchObject({ success: false });
    const snapshot = await game.snapshot();
    expect(snapshot.progress.status).toBe('break_intro');
    expect(snapshot.ungradedQuestionIds).toEqual([]);
    expect(
      snapshot.leaderboard.find((entry) => entry.teamId === teamId)
        ?.totalPoints,
    ).toBe(1);
  });
});

describe('GameGateway — session write: a timer expiry', () => {
  const harness = setupRealStoreGatewayTest();

  it('keeps a bonus awarded while the lock timer’s expiry waits on its save', async () => {
    const game = await harness.createGateway({
      teamNames: ['Timed Team'],
      settings: { lockGraceSeconds: 1 },
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'QA1', answer: 'A1' }],
        },
      ],
    });
    const admin = await game.connectAdmin();
    const [{ teamId }] = game.teams;
    for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
      await game.act(action);
    }
    await game.act('ADVANCE'); // -> locking, lock armed
    const held = holdNextCall(game.progressRepository, 'save');
    await held.started;

    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId,
      category: 'shot',
      points: 2,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    held.release();
    await awarding;
    await new Promise((resolve) => setTimeout(resolve, 300));

    const snapshot = await game.snapshot();
    expect(snapshot.progress.status).toBe('break_intro');
    expect(
      snapshot.leaderboard.find((entry) => entry.teamId === teamId)
        ?.bonusPoints,
    ).toBe(2);
  });
});
