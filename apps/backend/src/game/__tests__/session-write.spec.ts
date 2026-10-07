import { Logger } from '@nestjs/common';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type LeaderboardEntry,
  type AdminStatePayload,
} from '@campus-pubquiz/types';
import { Round } from '@/db/entities/round.entity';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  holdNextCall,
  type JoinedTeam,
  setupRealStoreGatewayTest,
  tieOnFirstQuestion,
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

  function adminSnapshots(joinCode = game.joinCode): AdminStatePayload[] {
    const adminRoom = sessionRoom(joinCode, SOCKET_ROOMS.ADMIN);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as AdminStatePayload);
  }

  function bonusIn(snapshot: AdminStatePayload): number | undefined {
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

  it('ends with both awards on the leaderboard when the first award’s standings read finishes last', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');

    const first = award(1);
    await held.started;
    const waiting = game.nextWriteWaiting();
    const second = award(2);
    await waiting;
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

  it('keeps the earlier leaderboard when the standings read after a bonus fails, and shows both awards after the next change', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest
      .spyOn(game.standingsService, 'leaderboard')
      .mockRejectedValueOnce(new Error('standings unavailable'));
    const before = await game.snapshot();

    // The award itself is saved, so the write counts as done.
    await expect(award(1)).resolves.toEqual({ success: true });
    expect((await game.snapshot()).leaderboard).toEqual(before.leaderboard);

    game.clearEmits();
    await award(2);

    const snapshots = adminSnapshots();
    // Both awards are stored; the first one's points show once standings are re-read.
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

  function adminSnapshots(): AdminStatePayload[] {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    return game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as AdminStatePayload);
  }

  function lastAdminSnapshot(): AdminStatePayload {
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

  function totalPoints(snapshot: AdminStatePayload): number {
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
    const waiting = game.nextWriteWaiting();
    const second = grade(secondAnswer, 2);
    await waiting;
    held.release();
    await Promise.all([first, second]);

    expect(totalPoints(lastAdminSnapshot())).toBe(3);
  });

  it('shows both teams as answered when the first answer’s answered-teams read finishes last', async () => {
    const questionId = game.questionIds.multipleChoice;

    const held = holdNextCall(game.answerService, 'listForQuestion');
    const first = submit(teamA, questionId, 'Paris');
    await held.started;
    const waiting = game.nextWriteWaiting();
    const second = submit(teamB, questionId, 'Paris');
    await waiting;
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
    const waiting = game.nextWriteWaiting();
    const second = grade(secondAnswer, 0);
    await waiting;
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

  function lastAdminSnapshot(): AdminStatePayload {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as AdminStatePayload);
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

  it('ends with the joined team connected and the kicked team gone when the kick’s standings read finishes last', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const kicking = kick(kicked.teamId);
    await held.started;

    const waiting = game.nextWriteWaiting();
    const { joined } = await startJoin('Newcomers');
    await waiting;
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

    const waiting = game.nextWriteWaiting();
    const { joined } = await startJoin('Latecomers');
    await waiting;
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

  function lastAdminSnapshot(): AdminStatePayload {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as AdminStatePayload);
    return snapshots[snapshots.length - 1];
  }

  function press() {
    return game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
  }

  it('keeps an answer submitted while an Advance waits on its progress save', async () => {
    const questionId = game.questionIds.multipleChoice;
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = press();
    await held.started;

    const waiting = game.nextWriteWaiting();
    const submitting = game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value: 'Paris',
    });
    await waiting;
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
    const waiting = game.nextWriteWaiting();
    const joining = game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName: 'Latecomers',
      joinCode: game.joinCode,
    });
    await waiting;
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

    const waiting = game.nextWriteWaiting();
    const kicking = game.gateway.handleKickTeam(asSocket(admin), {
      teamId: team.teamId,
    });
    await waiting;
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
    const expiring = game.timers().lock.fireNow();
    await held.started;

    const waiting = game.nextWriteWaiting();
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId,
      category: 'shot',
      points: 2,
    });
    await waiting;
    held.release();
    await awarding;
    await expiring;

    const snapshot = await game.snapshot();
    expect(snapshot.progress.status).toBe('break_intro');
    expect(
      snapshot.leaderboard.find((entry) => entry.teamId === teamId)
        ?.bonusPoints,
    ).toBe(2);
  });
});

describe('GameGateway — session write: quiz edits and re-imports', () => {
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

  function lastAdminSnapshot(): AdminStatePayload {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as AdminStatePayload);
    return snapshots[snapshots.length - 1];
  }

  // QuizController.update and the re-import both end in notifyQuizEdited,
  // inside an HTTP request context.
  function editQuiz() {
    return game.inRequestContext(() =>
      game.gateway.notifyQuizEdited(game.joinCode),
    );
  }

  function submit(questionId: number, value: string) {
    return game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value,
    });
  }

  it('keeps a grade, and the cleared ungraded marker, made while a quiz edit waits on its reload', async () => {
    await game.act('ADVANCE'); // -> free_text
    const questionId = game.questionIds.freeText;
    await submit(questionId, 'Saturn');
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    expect(lastAdminSnapshot().ungradedQuestionIds).toEqual([questionId]);

    const held = holdNextCall(game.seedService, 'loadGame');
    const editing = editQuiz();
    await held.started;
    const waiting = game.nextWriteWaiting();
    const grading = game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 1,
    });
    await waiting;
    held.release();
    await Promise.all([editing, grading]);

    expect(lastAdminSnapshot().ungradedQuestionIds).toEqual([]);
    const snapshot = await game.snapshot();
    expect(snapshot.ungradedQuestionIds).toEqual([]);
    expect(
      snapshot.leaderboard.find((entry) => entry.teamId === team.teamId)
        ?.totalPoints,
    ).toBe(1);
  });

  it('still shows an answer submitted while a reload is held as answered', async () => {
    const questionId = game.questionIds.multipleChoice;

    const held = holdNextCall(game.seedService, 'loadGame');
    const editing = editQuiz();
    await held.started;
    const waiting = game.nextWriteWaiting();
    const submitting = submit(questionId, 'Paris');
    await waiting;
    held.release();
    await Promise.all([editing, submitting]);

    expect(lastAdminSnapshot().answeredTeamIds).toContain(team.teamId);
    expect((await game.snapshot()).answeredTeamIds).toContain(team.teamId);
  });

  it('finishes a quiz edit made while a press is held after the press, with both changes in the final snapshot', async () => {
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await held.started;
    const before = await game.snapshot();
    await game.inRequestContext(async () => {
      const em = game.orm.em.fork();
      const round = await em.findOneOrFail(Round, { title: 'Round 1' });
      round.title = 'Renamed Round';
      await em.flush();
    });

    const waiting = game.nextWriteWaiting();
    const editing = editQuiz();
    await waiting;
    held.release();
    await Promise.all([pressing, editing]);

    const snapshot = await game.snapshot();
    expect(snapshot.progress).not.toEqual(before.progress);
    expect(snapshot.roundTitles).toContain('Renamed Round');
    expect(lastAdminSnapshot().roundTitles).toContain('Renamed Round');
  });
});

describe('GameGateway — session write: events that do not touch scores', () => {
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

  function lastAdminSnapshot(): AdminStatePayload {
    const adminRoom = sessionRoom(game.joinCode, SOCKET_ROOMS.ADMIN);
    const snapshots = game
      .roomEmits()
      .filter(
        (emit) =>
          emit.rooms.includes(adminRoom) &&
          emit.event === SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((emit) => emit.payload as AdminStatePayload);
    return snapshots[snapshots.length - 1];
  }

  function isTeamConnected(snapshot: AdminStatePayload): boolean | undefined {
    return snapshot.teams.find((entry) => entry.teamId === team.teamId)
      ?.isConnected;
  }

  it('shows a team that disconnects while a bonus write is held as disconnected once both finish', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: team.teamId,
      category: 'shot',
      points: 1,
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const disconnecting = game.gateway.handleDisconnect(asSocket(team.socket));
    await waiting;
    held.release();
    await Promise.all([awarding, disconnecting]);

    expect(isTeamConnected(lastAdminSnapshot())).toBe(false);
    expect(isTeamConnected(await game.snapshot())).toBe(false);
  });

  it('shows a team that disconnects while a press waits on its save as disconnected', async () => {
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const disconnecting = game.gateway.handleDisconnect(asSocket(team.socket));
    await waiting;
    held.release();
    await Promise.all([pressing, disconnecting]);

    expect(isTeamConnected(lastAdminSnapshot())).toBe(false);
    expect(isTeamConnected(await game.snapshot())).toBe(false);
  });

  it('keeps a break end time and a display text size set while a press waits on its save', async () => {
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await held.started;

    const breakEndsAt = Date.now() + 600_000;
    const waiting = Promise.all([
      game.nextWriteWaiting(),
      game.nextWriteWaiting(),
    ]);
    const settingBreak = game.gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt,
    });
    const scaling = game.gateway.handleSetDisplayTextScale(asSocket(admin), {
      displayTextScale: 1.5,
    });
    await waiting;
    held.release();
    await Promise.all([pressing, settingBreak, scaling]);

    const snapshot = await game.snapshot();
    expect(snapshot.breakEndsAt).toBe(breakEndsAt);
    expect(snapshot.displayTextScale).toBe(1.5);
    expect(lastAdminSnapshot().displayTextScale).toBe(1.5);
  });

  it('does not read standings for a disconnect, a break end time or a display text size, and leaves the stored leaderboard as it was', async () => {
    const before = await game.snapshot();
    const leaderboard = jest.spyOn(game.standingsService, 'leaderboard');

    await game.gateway.handleDisconnect(asSocket(team.socket));
    await game.gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: Date.now() + 60_000,
    });
    await game.gateway.handleSetDisplayTextScale(asSocket(admin), {
      displayTextScale: 1.25,
    });

    expect(leaderboard).not.toHaveBeenCalled();
    expect((await game.snapshot()).leaderboard).toEqual(before.leaderboard);
  });
});

describe('GameGateway — session write: showdown', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let admin: MockSocket;
  let teamA: JoinedTeam;
  let showdownRoundId: number;

  const SHOWDOWN_PAYLOAD = { question: 'How many?', answer: '100', points: 5 };

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['Team A', 'Team B'] });
    await tieOnFirstQuestion(game, game.teams);
    admin = await game.connectAdmin();
    [teamA] = game.teams;
    await game.gateway.handleCreateShowdownRound(
      asSocket(admin),
      SHOWDOWN_PAYLOAD,
    );
    showdownRoundId = (await game.snapshot()).activeShowdown!.id;
    game.clearEmits();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function hasGuessed(snapshot: AdminStatePayload): boolean | undefined {
    return snapshot.activeShowdown?.participants.find(
      (participant) => participant.teamId === teamA.teamId,
    )?.hasGuessed;
  }

  function guess() {
    return game.gateway.handleSubmitShowdownGuess(asSocket(teamA.socket), {
      showdownRoundId,
      teamId: teamA.teamId,
      value: '95',
    });
  }

  it('has a showdown guess submitted while a bonus write is held in the final snapshot', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const awarding = game.gateway.handleAwardBonus(asSocket(admin), {
      teamId: teamA.teamId,
      category: 'shot',
      points: 1,
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const guessing = guess();
    await waiting;
    held.release();
    await Promise.all([awarding, guessing]);

    expect(hasGuessed(await game.snapshot())).toBe(true);
  });

  it('has a showdown guess submitted while a press waits on its save in the final snapshot', async () => {
    const held = holdNextCall(game.progressRepository, 'save');
    const pressing = game.gateway.handleAdminAction(asSocket(admin), {
      action: 'ADVANCE',
    });
    await held.started;

    const waiting = game.nextWriteWaiting();
    const guessing = guess();
    await waiting;
    held.release();
    await Promise.all([pressing, guessing]);

    expect(hasGuessed(await game.snapshot())).toBe(true);
  });
});

describe('GameGateway — session write: new showdown round', () => {
  const harness = setupRealStoreGatewayTest();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not read standings for a new showdown round or a guess', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A', 'Team B'],
    });
    await tieOnFirstQuestion(game, game.teams);
    const admin = await game.connectAdmin();
    const before = await game.snapshot();
    const leaderboard = jest.spyOn(game.standingsService, 'leaderboard');

    await game.gateway.handleCreateShowdownRound(asSocket(admin), {
      question: 'How many?',
      answer: '100',
      points: 5,
    });
    const [first] = game.teams;
    await game.gateway.handleSubmitShowdownGuess(asSocket(first.socket), {
      showdownRoundId: (await game.snapshot()).activeShowdown!.id,
      teamId: first.teamId,
      value: '95',
    });

    expect(leaderboard).not.toHaveBeenCalled();
    expect((await game.snapshot()).leaderboard).toEqual(before.leaderboard);
  });
});

describe('GameGateway — session write: lobby settings', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function updateSettings() {
    return game.inRequestContext(() =>
      game.gameState.updateSessionSettings(game.joinCode, {
        lockGraceSeconds: 17,
      }),
    );
  }

  async function startJoin(teamName: string) {
    const socket = await game.connectPlayer();
    return game.gateway.handleJoinPlayers(asSocket(socket), {
      teamName,
      joinCode: game.joinCode,
    });
  }

  function expectSettingsAndTeam(snapshot: AdminStatePayload): void {
    expect(
      game.gameState.getSnapshot(game.joinCode).settings.lockGraceSeconds,
    ).toBe(17);
    const joined = snapshot.teams.find(
      (team) => team.teamName === 'Latecomers',
    );
    expect(joined?.isConnected).toBe(true);
  }

  it('keeps both the new settings and the team that joined while the settings write waits on its save', async () => {
    const held = holdNextCall(game.seedService, 'updateSettings');
    const updating = updateSettings();
    await held.started;

    const waiting = game.nextWriteWaiting();
    const joining = startJoin('Latecomers');
    await waiting;
    held.release();
    await Promise.all([updating, joining]);

    expectSettingsAndTeam(await game.snapshot());
  });

  it('keeps both the new settings and the team whose join is held on its standings read', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const joining = startJoin('Latecomers');
    await held.started;

    const waiting = game.nextWriteWaiting();
    const updating = updateSettings();
    await waiting;
    held.release();
    await Promise.all([updating, joining]);

    expectSettingsAndTeam(await game.snapshot());
  });

  it('does not read standings for a settings change', async () => {
    const leaderboard = jest.spyOn(game.standingsService, 'leaderboard');
    const before = await game.snapshot();

    await updateSettings();

    expect(leaderboard).not.toHaveBeenCalled();
    expect((await game.snapshot()).leaderboard).toEqual(before.leaderboard);
  });
});

describe('GameGateway — session write: closing a session', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ teamNames: ['The Quizzards'] });
    // The seeded session is the default one, which close refuses to evict —
    // a second session takes over as default.
    await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    await game.act('START_QUIZ');
    await game.act('END_QUIZ');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function bonusChanged() {
    return game.inRequestContext(() =>
      game.gameState.bonusChanged(game.joinCode),
    );
  }

  it('finishes the write in progress, closes the session for good and fails a write queued behind the close with the unknown-session error', async () => {
    const held = holdNextCall(game.standingsService, 'leaderboard');
    const inProgress = bonusChanged();
    await held.started;

    const waiting = Promise.all([
      game.nextWriteWaiting(),
      game.nextWriteWaiting(),
    ]);
    const closing = game.gameState.closeSession(game.joinCode);
    const behindClose = bonusChanged();
    const behindCloseOutcome =
      expect(behindClose).rejects.toThrow(/Unknown game session/);
    await waiting;
    held.release();

    await expect(inProgress).resolves.toBeDefined();
    await closing;
    await behindCloseOutcome;
    expect(game.gameState.hasSession(game.joinCode)).toBe(false);
  });
});
