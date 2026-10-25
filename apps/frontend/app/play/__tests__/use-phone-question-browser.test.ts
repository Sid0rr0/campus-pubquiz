import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { AUTO_ADVANCE_STORAGE_KEY } from '@/app/lib/player-settings-storage';
import { usePhoneQuestionBrowser } from '@/app/play/use-phone-question-browser';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const ROUNDS = [
  {
    questions: [
      { prompt: 'Name a fruit' },
      { prompt: 'Name a planet' },
      { prompt: 'Name a country' },
    ],
  },
];

function playersView(session: SessionDescription) {
  return roomView(SOCKET_ROOMS.PLAYERS, session);
}

function open(questionIndex: number): SessionDescription {
  return {
    rounds: ROUNDS,
    progress: { status: 'question_open', questionIndex },
  };
}

function reveal(revealIndex: number): SessionDescription {
  return {
    rounds: ROUNDS,
    progress: { status: 'reveal', revealIndex, questionIndex: 2 },
  };
}

describe('usePhoneQuestionBrowser', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a browsed question when the same question is still current on the next render', () => {
    const { result, rerender } = renderHook(
      ({ session }) => usePhoneQuestionBrowser(playersView(session)),
      { initialProps: { session: open(0) } },
    );
    rerender({ session: open(1) });
    expect(result.current.selectedQuestion?.prompt).toBe('Name a planet');
    const first = result.current.jumpableQuestionIds.values().next().value!;

    act(() => result.current.selectQuestion(first));
    rerender({ session: open(1) });

    expect(result.current.selectedQuestion?.prompt).toBe('Name a fruit');
  });

  it('keeps a browsed question when the same reveal step is shown on the next render', () => {
    const { result, rerender } = renderHook(
      ({ session }) => usePhoneQuestionBrowser(playersView(session)),
      { initialProps: { session: reveal(0) } },
    );
    rerender({ session: reveal(1) });
    expect(result.current.selectedQuestion?.prompt).toBe('Name a planet');
    const first = result.current.jumpableQuestionIds.values().next().value!;

    act(() => result.current.selectQuestion(first));
    rerender({ session: reveal(1) });

    expect(result.current.selectedQuestion?.prompt).toBe('Name a fruit');
  });

  it('snaps back to the newest question when a new one opens', () => {
    const { result, rerender } = renderHook(
      ({ session }) => usePhoneQuestionBrowser(playersView(session)),
      { initialProps: { session: open(1) } },
    );
    const first = result.current.jumpableQuestionIds.values().next().value!;
    act(() => result.current.selectQuestion(first));
    expect(result.current.selectedQuestion?.prompt).toBe('Name a fruit');

    rerender({ session: open(2) });

    expect(result.current.selectedQuestion?.prompt).toBe('Name a country');
  });

  it('stores the auto-advance setting when it is switched', () => {
    const { result } = renderHook(() =>
      usePhoneQuestionBrowser(playersView(open(0))),
    );

    act(() => result.current.setAutoAdvance(false));

    expect(window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY)).toBe('0');
    expect(result.current.autoAdvanceEnabled).toBe(false);

    act(() => result.current.setAutoAdvance(true));

    expect(window.localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY)).toBe('1');
  });

  it('shows no question while the phone is not on the block browser', () => {
    const { result } = renderHook(() =>
      usePhoneQuestionBrowser(
        playersView({ rounds: ROUNDS, progress: { status: 'lobby' } }),
      ),
    );

    expect(result.current.selectedQuestion).toBeNull();
    expect(result.current.jumpableQuestionIds.size).toBe(0);
  });
});
