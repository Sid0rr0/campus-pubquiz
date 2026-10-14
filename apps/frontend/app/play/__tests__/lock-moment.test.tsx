import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStatus } from '@campus-pubquiz/types';
import { LockMoment, lockBarFraction } from '@/app/play/lock-moment';

const { mockVibrate } = vi.hoisted(() => ({ mockVibrate: vi.fn() }));

vi.mock('@/app/lib/vibrate', () => ({ vibrate: mockVibrate }));

const NOW = 1_000_000;

interface Props {
  status: GameStatus;
  lockAt: number | null;
  isConnected: boolean;
}

function renderMoment(initial: Props) {
  const view = render(<LockMoment {...initial} />);
  return {
    update: (next: Props) => view.rerender(<LockMoment {...next} />),
  };
}

describe('lockBarFraction', () => {
  it('is the share of the span still left before the deadline', () => {
    expect(lockBarFraction(NOW + 30_000, NOW, 60_000)).toBe(0.5);
  });

  it('is 0 once the deadline has passed', () => {
    expect(lockBarFraction(NOW - 1, NOW, 60_000)).toBe(0);
  });

  it('never exceeds 1', () => {
    expect(lockBarFraction(NOW + 90_000, NOW, 60_000)).toBe(1);
  });

  it('is 0 for an empty span', () => {
    expect(lockBarFraction(NOW, NOW, 0)).toBe(0);
  });
});

describe('LockMoment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockVibrate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('bar', () => {
    it('drains with the time left to the lock deadline', () => {
      renderMoment({
        status: 'locking',
        lockAt: NOW + 20_000,
        isConnected: true,
      });
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '100',
      );

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '50',
      );
    });

    it('is absent while the question is merely open', () => {
      renderMoment({
        status: 'question_open',
        lockAt: null,
        isConnected: true,
      });

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('is absent while locking has no armed deadline', () => {
      renderMoment({ status: 'locking', lockAt: null, isConnected: true });

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('Locked stamp', () => {
    it('stamps and vibrates when a connected phone sees the block lock', () => {
      const moment = renderMoment({
        status: 'locking',
        lockAt: NOW + 5_000,
        isConnected: true,
      });

      moment.update({ status: 'break_intro', lockAt: null, isConnected: true });

      expect(screen.getByText('Locked')).toBeInTheDocument();
      expect(mockVibrate).toHaveBeenCalledTimes(1);
      expect(mockVibrate).toHaveBeenCalledWith('lock');
    });

    it('goes away by itself', () => {
      const moment = renderMoment({
        status: 'locking',
        lockAt: NOW + 5_000,
        isConnected: true,
      });
      moment.update({ status: 'break_intro', lockAt: null, isConnected: true });

      act(() => {
        vi.advanceTimersByTime(3_000);
      });

      expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    });

    it('stays silent when the phone loads into an already locked block', () => {
      renderMoment({ status: 'break', lockAt: null, isConnected: true });

      expect(screen.queryByText('Locked')).not.toBeInTheDocument();
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('stays silent when the lock is only seen after a reconnect', () => {
      const moment = renderMoment({
        status: 'locking',
        lockAt: NOW + 5_000,
        isConnected: true,
      });

      moment.update({ status: 'locking', lockAt: null, isConnected: false });
      moment.update({ status: 'break', lockAt: null, isConnected: true });

      expect(screen.queryByText('Locked')).not.toBeInTheDocument();
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('stays silent on a Previous move back into locking', () => {
      const moment = renderMoment({
        status: 'break_intro',
        lockAt: null,
        isConnected: true,
      });

      moment.update({
        status: 'locking',
        lockAt: NOW + 5_000,
        isConnected: true,
      });

      expect(screen.queryByText('Locked')).not.toBeInTheDocument();
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('does not stamp again while moving on inside the locked block', () => {
      const moment = renderMoment({
        status: 'locking',
        lockAt: NOW + 5_000,
        isConnected: true,
      });
      moment.update({ status: 'break_intro', lockAt: null, isConnected: true });
      moment.update({ status: 'break', lockAt: null, isConnected: true });

      expect(mockVibrate).toHaveBeenCalledTimes(1);
    });
  });
});
