import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';

type Handler = (...args: unknown[]) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler[]>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    trigger(event: string, payload: unknown) {
      for (const handler of handlers.get(event) ?? []) {
        handler(payload);
      }
    },
  };
}

const { mockIo } = vi.hoisted(() => ({
  mockIo: vi.fn(() => createFakeSocket()),
}));

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

function getFakeSocket() {
  return mockIo.mock.results[mockIo.mock.results.length - 1]
    ?.value as ReturnType<typeof createFakeSocket>;
}

describe('useGameSocket — admin and player actions', () => {
  beforeEach(() => {
    mockIo.mockClear();
  });

  it('sendAction emits an ADMIN_ACTION event with the action payload', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.sendAction('START_QUIZ');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ADMIN_ACTION, {
      action: 'START_QUIZ',
    });
  });

  it('joinTeam emits a JOIN_PLAYERS event with the team name, token and join code', () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.joinTeam('The Quizzards', {
        teamToken: 'existing-token',
        joinCode: 'ABCDEF',
      });
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.JOIN_PLAYERS, {
      teamName: 'The Quizzards',
      teamToken: 'existing-token',
      joinCode: 'ABCDEF',
    });
  });

  it('adopts the joined team identity on JOIN_ACCEPTED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: 'team-1',
        teamName: 'The Quizzards',
        teamToken: 'team-token-1',
      });
    });

    await waitFor(() =>
      expect(result.current.team).toEqual({
        teamId: 'team-1',
        teamName: 'The Quizzards',
        teamToken: 'team-token-1',
      }),
    );
  });

  it('submitAnswer emits a SUBMIT_ANSWER event with questionId, teamId, and value', () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.submitAnswer(1, 1, 'Banana');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SUBMIT_ANSWER, {
      questionId: 1,
      teamId: 1,
      value: 'Banana',
    });
  });

  it('adopts the live answers list on ANSWERS_UPDATED', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();
    const payload = {
      questionId: 'r1q1',
      answers: [
        {
          answerId: 'answer-1',
          teamId: 'team-1',
          teamName: 'The Quizzards',
          value: 'Banana',
          pointsAwarded: 0,
          gradedAt: null,
        },
      ],
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, payload);
    });

    await waitFor(() => expect(result.current.liveAnswers).toEqual(payload));
  });

  it('gradeAnswer emits a GRADE_ANSWER event with answerId and pointsAwarded', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.gradeAnswer(1, 2);
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.GRADE_ANSWER, {
      answerId: 1,
      pointsAwarded: 2,
    });
  });

  it('awardBonus emits an AWARD_BONUS event with teamId, category, points and reason', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.awardBonus(31, 'custom', 3, 'Best team name');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.AWARD_BONUS, {
      teamId: 31,
      category: 'custom',
      points: 3,
      reason: 'Best team name',
    });
  });

  it('setLiveAnswers writes a REST-fetched payload into liveAnswers', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const payload = {
      questionId: 1,
      question: {
        type: 'free_text' as const,
        prompt: 'Q1',
        points: 1,
        correctAnswer: 'A1',
        roundTitle: 'Round 1',
        roundNumber: 1,
        questionNumberInRound: 1,
        totalQuestionsInRound: 1,
      },
      answers: [],
    };

    act(() => {
      result.current.setLiveAnswers(payload);
    });

    expect(result.current.liveAnswers).toEqual(payload);
  });

  it('seeds the team saved answers from JOIN_ACCEPTED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: 'team-1',
        teamName: 'The Quizzards',
        teamToken: 'team-token-1',
        answers: [{ questionId: 'r1q1', value: 'Banana' }],
      });
    });

    await waitFor(() =>
      expect(result.current.myAnswers).toEqual({ r1q1: 'Banana' }),
    );
  });

  it('records the acknowledged answer on ANSWER_RECEIVED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.ANSWER_RECEIVED, {
        questionId: 'r1q2',
        teamId: 'team-1',
        teamName: 'The Quizzards',
        value: 'Carrot',
        pointsAwarded: 0,
        gradedAt: null,
      });
    });

    await waitFor(() =>
      expect(result.current.myAnswers).toEqual({ r1q2: 'Carrot' }),
    );
  });

  it('seeds myAnswerGrades from an already-graded answer on JOIN_ACCEPTED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, {
        teamId: 'team-1',
        teamName: 'The Quizzards',
        teamToken: 'team-token-1',
        answers: [
          {
            questionId: 'r1q1',
            value: 'Banana',
            pointsAwarded: 3,
            gradedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            questionId: 'r1q2',
            value: 'Carrot',
            pointsAwarded: 0,
            gradedAt: null,
          },
        ],
      });
    });

    await waitFor(() =>
      expect(result.current.myAnswerGrades).toEqual({
        r1q1: { pointsAwarded: 3, gradedAt: '2024-01-01T00:00:00.000Z' },
      }),
    );
  });

  it('records points instantly for an auto-graded answer on ANSWER_RECEIVED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.ANSWER_RECEIVED, {
        questionId: 'r1q3',
        teamId: 'team-1',
        teamName: 'The Quizzards',
        value: 'Paris',
        pointsAwarded: 2,
        gradedAt: '2024-01-01T00:00:00.000Z',
      });
    });

    await waitFor(() =>
      expect(result.current.myAnswerGrades).toEqual({
        r1q3: { pointsAwarded: 2, gradedAt: '2024-01-01T00:00:00.000Z' },
      }),
    );
  });

  it('replaces myAnswers and myAnswerGrades with the freshly-synced set on TEAM_ANSWERS_SYNCED', async () => {
    const { result } = renderHook(() => useGameSocket('players'));
    const fakeSocket = getFakeSocket();

    // Seed some stale prior state first — the sync should replace it wholesale.
    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.ANSWER_RECEIVED, {
        questionId: 'r1q1',
        teamId: 'team-1',
        teamName: 'The Quizzards',
        value: 'Stale',
        pointsAwarded: 0,
        gradedAt: null,
      });
    });

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, {
        answers: [
          {
            questionId: 'r1q4',
            value: 'Banana',
            pointsAwarded: 4,
            gradedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    await waitFor(() => {
      expect(result.current.myAnswers).toEqual({ r1q4: 'Banana' });
      expect(result.current.myAnswerGrades).toEqual({
        r1q4: { pointsAwarded: 4, gradedAt: '2024-01-01T00:00:00.000Z' },
      });
    });
  });
});
