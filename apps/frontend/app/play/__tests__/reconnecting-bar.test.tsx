import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReconnectingBar,
  RECONNECT_HELP_DELAY_MS,
} from '@/app/play/reconnecting-bar';

describe('ReconnectingBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the lost connection as an alert', () => {
    render(<ReconnectingBar onReconnect={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Connection lost — reconnecting…',
    );
  });

  it('offers no reconnect button until the help delay has passed', () => {
    render(<ReconnectingBar onReconnect={vi.fn()} />);

    act(() => {
      vi.advanceTimersByTime(RECONNECT_HELP_DELAY_MS - 1);
    });

    expect(
      screen.queryByRole('button', { name: 'Tap to reconnect' }),
    ).not.toBeInTheDocument();
  });

  it('offers a reconnect button after 10 seconds that calls onReconnect', () => {
    const onReconnect = vi.fn();
    render(<ReconnectingBar onReconnect={onReconnect} />);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tap to reconnect' }));

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
