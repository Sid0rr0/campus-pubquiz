import { describe, expect, it } from 'vitest';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type ActiveSessionSummary,
  type CreateSessionPayload,
  type GameSocketHandshakeQuery,
  type JoinAcceptedPayload,
  type ListAnswersPayload,
  type QuizzesListedPayload,
  type SelectQuizPayload,
  type StateSnapshotPayload,
} from './socket-events';

describe('SOCKET_EVENTS', () => {
  it('pins the exact event name strings shared across frontend and backend', () => {
    expect(SOCKET_EVENTS).toEqual({
      STATE_SYNC: 'game:state_sync',
      STATE_UPDATED: 'game:state_updated',
      ANSWER_RECEIVED: 'game:answer_received',
      JOIN_ACCEPTED: 'game:join_accepted',
      ANSWERS_UPDATED: 'game:answers_updated',
      ADMIN_ACTION: 'game:admin_action',
      SUBMIT_ANSWER: 'game:submit_answer',
      JOIN_PLAYERS: 'game:join_players',
      GRADE_ANSWER: 'game:grade_answer',
      SELECT_QUIZ: 'game:select_quiz',
      LIST_ANSWERS: 'game:list_answers',
      KICK_TEAM: 'game:kick_team',
      AWARD_BONUS: 'game:award_bonus',
    });
  });
});

describe('block answering payloads', () => {
  it('carries revealed block questions and answered team ids so clients can browse and indicate responses', () => {
    const snapshot: StateSnapshotPayload = {
      progress: {
        status: 'question_open',
        roundIndex: 0,
        questionIndex: 1,
        isLeaderboardVisible: false,
        revealIndex: 0,
      },
      quizStructure: { blockCount: 1, topicsPerBlock: 1 },
      roundTitle: 'Round 1',
      currentQuestion: { id: 2, type: 'free_text', prompt: 'Second?', points: 10 },
      blockQuestions: [
        { id: 1, type: 'free_text', prompt: 'First?', points: 10, roundNumber: 1, questionNumberInRound: 1 },
        { id: 2, type: 'free_text', prompt: 'Second?', points: 10, roundNumber: 1, questionNumberInRound: 2 },
      ],
      upcomingQuestions: [],
      revealQuestions: [],
      answeredTeamIds: [1],
      leaderboard: [],
      leaderboardRevealCount: 0,
      joinCode: 'ABC234',
      teams: [{ teamId: 1, teamName: 'Quizzards', isConnected: true }],
      questionLockAt: null,
    };
    const listAnswers: ListAnswersPayload = { questionId: 1 };

    expect(snapshot.blockQuestions.map((question) => question.id)).toContain(
      listAnswers.questionId,
    );
    expect(snapshot.answeredTeamIds).toContain(snapshot.teams[0].teamId);
  });

  it('carries the correct answer alongside each reveal question', () => {
    const snapshot: StateSnapshotPayload = {
      progress: {
        status: 'reveal',
        roundIndex: 0,
        questionIndex: 1,
        isLeaderboardVisible: false,
        revealIndex: 0,
      },
      quizStructure: { blockCount: 1, topicsPerBlock: 1 },
      roundTitle: 'Round 1',
      currentQuestion: null,
      blockQuestions: [],
      upcomingQuestions: [],
      revealQuestions: [
        { id: 1, type: 'free_text', prompt: 'First?', points: 10, answer: 'One' },
        { id: 2, type: 'free_text', prompt: 'Second?', points: 10, answer: 'Two' },
      ],
      answeredTeamIds: [],
      leaderboard: [],
      leaderboardRevealCount: 0,
      joinCode: 'ABC234',
      teams: [],
      questionLockAt: null,
    };

    expect(snapshot.revealQuestions.map((question) => question.answer)).toEqual([
      'One',
      'Two',
    ]);
  });

  it('returns the team saved answers on join so a reconnecting phone restores its checkmarks', () => {
    const joined: JoinAcceptedPayload = {
      teamId: 1,
      teamToken: 'token-1',
      teamCode: 'ABC234',
      teamName: 'Quizzards',
      answers: [{ questionId: 1, value: '42' }],
    };

    expect(joined.answers).toEqual([{ questionId: 1, value: '42' }]);
  });
});

describe('quiz selection payloads', () => {
  it('carries quiz summaries and the active quiz id so the admin can pick a quiz', () => {
    const listed: QuizzesListedPayload = {
      activeQuizId: 1,
      quizzes: [
        {
          id: 1,
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: false,
              questions: [{ id: 1, prompt: 'Name a fruit', answer: 'Banana' }],
            },
          ],
        },
        { id: 2, title: 'Imported Quiz', rounds: [] },
      ],
    };
    const select: SelectQuizPayload = { quizId: 2 };

    expect(listed.quizzes.map((quiz) => quiz.id)).toContain(select.quizId);
  });
});

describe('SOCKET_ROOMS', () => {
  it('pins the exact room name strings shared across frontend and backend', () => {
    expect(SOCKET_ROOMS).toEqual({
      DISPLAY: 'display',
      ADMIN: 'admin',
      PLAYERS: 'players',
    });
  });
});

describe('sessionRoom', () => {
  it('joins role and code with a colon so each session gets its own room per role', () => {
    expect(sessionRoom('ABC234', SOCKET_ROOMS.DISPLAY)).toBe('display:ABC234');
    expect(sessionRoom('ABC234', SOCKET_ROOMS.ADMIN)).toBe('admin:ABC234');
    expect(sessionRoom('ABC234', SOCKET_ROOMS.PLAYERS)).toBe('players:ABC234');
  });

  it('produces distinct room names for different join codes with the same role', () => {
    expect(sessionRoom('AAA111', SOCKET_ROOMS.DISPLAY)).not.toBe(
      sessionRoom('BBB222', SOCKET_ROOMS.DISPLAY),
    );
  });
});

describe('GameSocketHandshakeQuery', () => {
  it('allows a bare role (today\'s single-session handshake) with no code', () => {
    const query: GameSocketHandshakeQuery = { role: SOCKET_ROOMS.ADMIN };

    expect(query.code).toBeUndefined();
  });

  it('allows role plus an optional session code for multi-session connections', () => {
    const query: GameSocketHandshakeQuery = { role: SOCKET_ROOMS.PLAYERS, code: 'ABC234' };

    expect(query).toEqual({ role: 'players', code: 'ABC234' });
  });
});

describe('session lifecycle payloads', () => {
  it('CreateSessionPayload carries the quiz id to start a new concurrent session', () => {
    const payload: CreateSessionPayload = { quizId: 5 };

    expect(payload.quizId).toBe(5);
  });

  it('ActiveSessionSummary describes one running session for the admin session picker', () => {
    const summary: ActiveSessionSummary = {
      joinCode: 'ABC234',
      quizId: 5,
      quizTitle: 'Campus Pub Quiz Night',
      status: 'question_open',
      teamCount: 3,
    };

    expect(summary.joinCode).toBe('ABC234');
    expect(summary.teamCount).toBe(3);
  });
});
