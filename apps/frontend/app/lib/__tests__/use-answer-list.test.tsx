import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SOCKET_EVENTS,
  type AnswersUpdatedPayload,
} from '@campus-pubquiz/types';
import { useAdminGame } from '@/app/lib/use-admin-game';
import { useAnswerList } from '@/app/lib/use-answer-list';
import { AnswerApiError } from '@/app/lib/answer-api';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';

const { mockIo, mockToastError, mockFetchAnswers } = vi.hoisted(() => ({
  mockIo: vi.fn(),
  mockToastError: vi.fn(),
  mockFetchAnswers: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('sonner', () => ({ toast: { error: mockToastError } }));
vi.mock('@/app/lib/answer-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/answer-api')>()),
  fetchAnswers: mockFetchAnswers,
}));

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

/** A list tagged by `marker`, which rides in the question prompt. */
function list(questionId: number, marker: string): AnswersUpdatedPayload {
  return {
    questionId,
    question: { prompt: marker },
    answers: [],
  } as unknown as AnswersUpdatedPayload;
}

function renderList(initial: { code: string; questionId: number | null }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ code, questionId }) => {
      useAdminGame(true, code);
      return useAnswerList(code, questionId);
    },
    { wrapper, initialProps: initial },
  );
  const socket = latestSocket();
  act(() => socket.serverConnects());
  return { ...hook, socket };
}

describe('useAnswerList', () => {
  beforeEach(() => {
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockToastError.mockReset();
    mockFetchAnswers.mockReset();
  });

  it('returns the question’s list once the read finishes', async () => {
    mockFetchAnswers.mockResolvedValue(list(1, 'read'));
    const { result } = renderList({ code: 'AAAAAA', questionId: 1 });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(list(1, 'read')));
    expect(mockFetchAnswers).toHaveBeenCalledWith('AAAAAA', 1);
  });

  it('updates from a broadcast for its question', async () => {
    mockFetchAnswers.mockResolvedValue(list(1, 'read'));
    const { result, socket } = renderList({ code: 'AAAAAA', questionId: 1 });
    await waitFor(() => expect(result.current).not.toBeNull());

    act(() => socket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, list(1, 'live')));

    await waitFor(() => expect(result.current).toEqual(list(1, 'live')));
  });

  it('leaves its list alone for a broadcast about another question', async () => {
    mockFetchAnswers.mockResolvedValue(list(1, 'read'));
    const { result, socket } = renderList({ code: 'AAAAAA', questionId: 1 });
    await waitFor(() => expect(result.current).not.toBeNull());

    act(() => socket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, list(2, 'other')));

    expect(result.current).toEqual(list(1, 'read'));
  });

  it('returns the new question’s list after switching, never the old one’s', async () => {
    mockFetchAnswers.mockImplementation((_code: string, id: number) =>
      Promise.resolve(list(id, `read ${id}`)),
    );
    const { result, rerender } = renderList({
      code: 'AAAAAA',
      questionId: 1,
    });
    await waitFor(() => expect(result.current).toEqual(list(1, 'read 1')));

    rerender({ code: 'AAAAAA', questionId: 2 });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual(list(2, 'read 2')));
  });

  it('keeps a broadcast that arrived while the read was in flight', async () => {
    let finishRead: (value: AnswersUpdatedPayload) => void = () => undefined;
    mockFetchAnswers.mockReturnValue(
      new Promise((resolve) => {
        finishRead = resolve;
      }),
    );
    const { result, socket } = renderList({ code: 'AAAAAA', questionId: 1 });
    act(() => socket.trigger(SOCKET_EVENTS.ANSWERS_UPDATED, list(1, 'live')));

    await act(async () => finishRead(list(1, 'late read')));

    await waitFor(() => expect(result.current).toEqual(list(1, 'live')));
  });

  it('reads again after a reconnect', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValue(2);
    mockFetchAnswers.mockResolvedValueOnce(list(1, 'first'));
    mockFetchAnswers.mockResolvedValueOnce(list(1, 'second'));
    const { result, socket } = renderList({ code: 'AAAAAA', questionId: 1 });
    await waitFor(() => expect(result.current).toEqual(list(1, 'first')));

    act(() => socket.serverConnects());

    await waitFor(() => expect(result.current).toEqual(list(1, 'second')));
  });

  it('shows no answers from the previous session after a session change', async () => {
    mockFetchAnswers.mockResolvedValueOnce(list(1, 'session A'));
    const { result, rerender } = renderList({ code: 'AAAAAA', questionId: 1 });
    await waitFor(() => expect(result.current).not.toBeNull());
    mockFetchAnswers.mockReturnValue(new Promise(() => undefined));

    rerender({ code: 'BBBBBB', questionId: 1 });

    expect(result.current).toBeNull();
  });

  it('returns nothing and reads nothing without a question', () => {
    const { result } = renderList({ code: 'AAAAAA', questionId: null });

    expect(result.current).toBeNull();
    expect(mockFetchAnswers).not.toHaveBeenCalled();
  });

  it('toasts when the read fails', async () => {
    mockFetchAnswers.mockRejectedValue(new AnswerApiError('boom', 500));
    const { result } = renderList({ code: 'AAAAAA', questionId: 1 });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
