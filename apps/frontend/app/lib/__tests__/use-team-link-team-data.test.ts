import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubmitEvent } from 'react';
import { SOCKET_EVENTS, type AckResult } from '@campus-pubquiz/types';
import {
  SUBMIT_CONFIRM_TIMEOUT_MS,
  useTeamLink,
} from '@/app/lib/use-team-link';
import { NOT_CONNECTED_MESSAGE } from '@/app/lib/connection-messages';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

// Runs the REAL adapter over a fake socket. The ordering rules live in
// team-link-team-data.test.ts; this file covers only what the adapter does:
// socket events reach the module, commands become emits, the confirmation
// timer and toasts.
const { mockIo, mockToast, mockToastError, mockToastSuccess } = vi.hoisted(
  () => ({
    mockIo: vi.fn(),
    mockToast: vi.fn(),
    mockToastError: vi.fn(),
    mockToastSuccess: vi.fn(),
  }),
);

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    error: mockToastError,
    success: mockToastSuccess,
  }),
}));

const ACCEPTED = {
  teamId: 31,
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'CODE',
  answers: [
    {
      questionId: 20,
      value: 'Paris',
      pointsAwarded: 2,
      gradedAt: '2026-10-01T10:00:00.000Z',
      verdict: 'correct',
    },
  ],
  bonusAwards: [],
  roundRatings: [],
  feedback: { comment: '', topics: [] },
};

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

function submitEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as SubmitEvent<HTMLFormElement>;
}

/** A phone that joined and was accepted. */
function renderLinkedTeam() {
  const hook = renderHook(() => useTeamLink(''));
  act(() => {
    hook.result.current.setNameInput('The Quizzards');
    hook.result.current.setCodeInput('abcdef');
  });
  act(() => hook.result.current.handleJoin(submitEvent()));
  const socket = latestSocket();
  act(() => socket.serverConnects());
  act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
  return { ...hook, socket };
}

function submit(result: { current: ReturnType<typeof useTeamLink> }) {
  let pending!: Promise<AckResult>;
  act(() => {
    pending = result.current.submitAnswer(21, 31, 'Banana');
  });
  return pending;
}

describe('useTeamLink: the team data and the pending answer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockToast.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('feeds join accepted, answer received and team answers synced into the team data', () => {
    const { result, socket } = renderLinkedTeam();
    expect(result.current.team?.teamId).toBe(31);
    expect(result.current.myAnswers).toEqual({ 20: 'Paris' });

    act(() =>
      socket.trigger(SOCKET_EVENTS.ANSWER_RECEIVED, {
        questionId: 21,
        teamId: 31,
        teamName: 'The Quizzards',
        value: 'Rome',
        pointsAwarded: 0,
        gradedAt: null,
        verdict: null,
      }),
    );
    expect(result.current.myAnswers).toEqual({ 20: 'Paris', 21: 'Rome' });

    act(() =>
      socket.trigger(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED, { answers: [] }),
    );
    expect(result.current.myAnswers).toEqual({});
  });

  it('accumulates the questions seen on the socket', () => {
    const { result, socket } = renderLinkedTeam();
    const question = { id: 5 };

    act(() =>
      socket.trigger(SOCKET_EVENTS.STATE_UPDATED, {
        progress: { status: 'lobby' },
        blockQuestions: [question],
      }),
    );

    expect(result.current.seenQuestions).toEqual({ 5: question });
  });

  it('toasts a live bonus award once, with its points', () => {
    const { socket } = renderLinkedTeam();

    act(() =>
      socket.trigger(SOCKET_EVENTS.BONUS_AWARDED, {
        category: 'selfie',
        points: 2,
      }),
    );

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess.mock.calls[0][0]).toContain('+2 points');
  });

  it('emits the answer and resolves once the server acknowledges it, without reconnecting', async () => {
    const { result, socket } = renderLinkedTeam();

    const pending = submit(result);
    expect(socket.lastEmitOf(SOCKET_EVENTS.SUBMIT_ANSWER).payload).toEqual({
      questionId: 21,
      teamId: 31,
      value: 'Banana',
    });
    await act(async () => socket.acknowledge(SOCKET_EVENTS.SUBMIT_ANSWER));

    await expect(pending).resolves.toEqual({ success: true, data: undefined });
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it('toasts a refused answer and does not resend it after a rejoin', async () => {
    const { result, socket } = renderLinkedTeam();

    const pending = submit(result);
    await act(async () =>
      socket.reject(SOCKET_EVENTS.SUBMIT_ANSWER, 'Answers are locked'),
    );
    await expect(pending).resolves.toMatchObject({ success: false });
    expect(mockToastError).toHaveBeenCalledWith('Answers are locked', {
      duration: undefined,
    });

    act(() => socket.serverDisconnects());
    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
    expect(socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER)).toHaveLength(1);
  });

  it('forces a fresh connection when the answer is never acknowledged, then resends it after the rejoin', async () => {
    vi.useFakeTimers();
    const { result, socket } = renderLinkedTeam();

    const pending = submit(result);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUBMIT_CONFIRM_TIMEOUT_MS);
    });

    await expect(pending).resolves.toEqual({
      success: false,
      error: NOT_CONNECTED_MESSAGE,
    });
    expect(socket.connect).toHaveBeenCalledTimes(1);

    act(() => socket.serverConnects());
    act(() => socket.trigger(SOCKET_EVENTS.JOIN_ACCEPTED, ACCEPTED));
    expect(socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER)).toHaveLength(2);
  });

  it('refuses with the "not connected" toast and sends nothing while unlinked', async () => {
    const { result, socket } = renderLinkedTeam();
    act(() => socket.serverDisconnects());

    const pending = submit(result);

    await expect(pending).resolves.toMatchObject({ success: false });
    expect(mockToastError).toHaveBeenCalledWith(NOT_CONNECTED_MESSAGE, {
      duration: undefined,
    });
    expect(socket.emitsOf(SOCKET_EVENTS.SUBMIT_ANSWER)).toHaveLength(0);
  });

  it('keeps an acknowledged rating after a rejoin only when the server held it', async () => {
    const { result, socket } = renderLinkedTeam();

    let rated!: Promise<AckResult>;
    act(() => {
      rated = result.current.rateRound(11, 4);
    });
    await act(async () => socket.acknowledge(SOCKET_EVENTS.RATE_ROUND));
    await rated;

    expect(result.current.myRoundRatings).toEqual({ 11: 4 });
  });
});
