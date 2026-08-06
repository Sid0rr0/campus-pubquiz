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
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value as ReturnType<typeof createFakeSocket>;
}

describe('useGameSocket', () => {
  beforeEach(() => {
    mockIo.mockClear();
  });

  it('connects with credentials so the session cookie is sent on the handshake', () => {
    renderHook(() => useGameSocket('admin'));

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3000', {
      query: { role: 'admin' },
      withCredentials: true,
    });
  });

  it('starts with no snapshot and no error', () => {
    const { result } = renderHook(() => useGameSocket('display'));
    expect(result.current.snapshot).toBeNull();
    expect(result.current.connectionError).toBeNull();
  });

  it('does not open a socket until enabled for admin connections', () => {
    renderHook(() => useGameSocket('admin', false));

    expect(mockIo).not.toHaveBeenCalled();
  });

  it('includes the join code in the handshake query when provided', () => {
    renderHook(() => useGameSocket('display', true, 'ABCDEF'));

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3000', {
      query: { role: 'display', code: 'ABCDEF' },
      withCredentials: true,
    });
  });

  it('reconnects with a new handshake query when the join code changes', () => {
    const { rerender } = renderHook(
      ({ joinCode }: { joinCode: string }) => useGameSocket('display', true, joinCode),
      { initialProps: { joinCode: 'AAAAAA' } },
    );
    const firstSocket = getFakeSocket();

    rerender({ joinCode: 'BBBBBB' });

    expect(firstSocket.disconnect).toHaveBeenCalled();
    expect(mockIo).toHaveBeenLastCalledWith('http://localhost:3000', {
      query: { role: 'display', code: 'BBBBBB' },
      withCredentials: true,
    });
  });

  it('adopts the snapshot sent on STATE_SYNC', async () => {
    const { result } = renderHook(() => useGameSocket('display'));
    const fakeSocket = getFakeSocket();
    const snapshot = { progress: { status: 'lobby', roundIndex: 0, questionIndex: 0, isLeaderboardVisible: false }, currentQuestion: null };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_SYNC, snapshot);
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
  });

  it('adopts the snapshot sent on STATE_UPDATED', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();
    const snapshot = {
      progress: { status: 'question_open', roundIndex: 0, questionIndex: 0, isLeaderboardVisible: false },
      currentQuestion: { id: 'r1q1', type: 'free_text' as const, prompt: 'Q?', points: 1 },
    };

    act(() => {
      fakeSocket.trigger(SOCKET_EVENTS.STATE_UPDATED, snapshot);
    });

    await waitFor(() => expect(result.current.snapshot).toEqual(snapshot));
  });

  it('surfaces a server exception as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('exception', { message: 'Only admin clients may perform game actions' });
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe('Only admin clients may perform game actions'),
    );
  });

  it('surfaces a socket connect_error as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('connect_error', { message: 'Invalid admin password' });
    });

    await waitFor(() => expect(result.current.connectionError).toBe('Invalid admin password'));
  });

  it('surfaces a server disconnect as a connection error', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('disconnect', 'io server disconnect');
    });

    await waitFor(() =>
      expect(result.current.connectionError).toBe('Disconnected: io server disconnect'),
    );
  });

  it('keeps the first error when a disconnect follows an exception', async () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      fakeSocket.trigger('exception', { message: 'Invalid admin password' });
      fakeSocket.trigger('disconnect', 'io server disconnect');
    });

    await waitFor(() => expect(result.current.connectionError).toBe('Invalid admin password'));
  });

  it('sendAction emits an ADMIN_ACTION event with the action payload', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.sendAction('START_QUIZ');
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.ADMIN_ACTION, { action: 'START_QUIZ' });
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderHook(() => useGameSocket('display'));
    const fakeSocket = getFakeSocket();
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
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

  it('selectQuiz emits a SELECT_QUIZ event with the quiz id', () => {
    const { result } = renderHook(() => useGameSocket('admin'));
    const fakeSocket = getFakeSocket();

    act(() => {
      result.current.selectQuiz(2);
    });

    expect(fakeSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.SELECT_QUIZ, {
      quizId: 2,
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

    await waitFor(() => expect(result.current.myAnswers).toEqual({ r1q1: 'Banana' }));
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
      });
    });

    await waitFor(() => expect(result.current.myAnswers).toEqual({ r1q2: 'Carrot' }));
  });

});
