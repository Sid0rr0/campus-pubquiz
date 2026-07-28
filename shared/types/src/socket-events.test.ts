import { describe, expect, it } from 'vitest';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
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
      QUIZZES_LISTED: 'game:quizzes_listed',
      ADMIN_ACTION: 'game:admin_action',
      SUBMIT_ANSWER: 'game:submit_answer',
      JOIN_PLAYERS: 'game:join_players',
      GRADE_ANSWER: 'game:grade_answer',
      LIST_QUIZZES: 'game:list_quizzes',
      SELECT_QUIZ: 'game:select_quiz',
      LIST_ANSWERS: 'game:list_answers',
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
      },
      currentQuestion: { id: 'q-2', type: 'free_text', prompt: 'Second?', points: 10 },
      blockQuestions: [
        { id: 'q-1', type: 'free_text', prompt: 'First?', points: 10 },
        { id: 'q-2', type: 'free_text', prompt: 'Second?', points: 10 },
      ],
      revealQuestions: [],
      answeredTeamIds: ['team-1'],
      leaderboard: [],
      joinCode: 'ABC234',
      teams: [{ teamId: 'team-1', teamName: 'Quizzards' }],
    };
    const listAnswers: ListAnswersPayload = { questionId: 'q-1' };

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
      },
      currentQuestion: null,
      blockQuestions: [],
      revealQuestions: [
        { id: 'q-1', type: 'free_text', prompt: 'First?', points: 10, answer: 'One' },
        { id: 'q-2', type: 'free_text', prompt: 'Second?', points: 10, answer: 'Two' },
      ],
      answeredTeamIds: [],
      leaderboard: [],
      joinCode: 'ABC234',
      teams: [],
    };

    expect(snapshot.revealQuestions.map((question) => question.answer)).toEqual([
      'One',
      'Two',
    ]);
  });

  it('returns the team saved answers on join so a reconnecting phone restores its checkmarks', () => {
    const joined: JoinAcceptedPayload = {
      teamId: 'team-1',
      teamToken: 'token-1',
      teamName: 'Quizzards',
      answers: [{ questionId: 'q-1', value: '42' }],
    };

    expect(joined.answers).toEqual([{ questionId: 'q-1', value: '42' }]);
  });
});

describe('quiz selection payloads', () => {
  it('carries quiz summaries and the active quiz id so the admin can pick a quiz', () => {
    const listed: QuizzesListedPayload = {
      activeQuizId: 'quiz-1',
      quizzes: [
        {
          id: 'quiz-1',
          title: 'Campus Pub Quiz Night',
          rounds: [
            {
              title: 'Round 1',
              breakAfter: false,
              questions: [{ id: 'q-1', prompt: 'Name a fruit', answer: 'Banana' }],
            },
          ],
        },
        { id: 'quiz-2', title: 'Imported Quiz', rounds: [] },
      ],
    };
    const select: SelectQuizPayload = { quizId: 'quiz-2' };

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
