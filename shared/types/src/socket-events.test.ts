import { describe, expect, it } from 'vitest';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type QuizzesListedPayload,
  type SelectQuizPayload,
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
    });
  });
});

describe('quiz selection payloads', () => {
  it('carries quiz summaries and the active quiz id so the admin can pick a quiz', () => {
    const listed: QuizzesListedPayload = {
      activeQuizId: 'quiz-1',
      quizzes: [
        { id: 'quiz-1', title: 'Campus Pub Quiz Night' },
        { id: 'quiz-2', title: 'Imported Quiz' },
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
