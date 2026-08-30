import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhaseTimer } from '@/app/admin/phase-timer';

describe('PhaseTimer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when both phaseStartedAt and phaseElapsedMs are null', () => {
    const { container } = render(
      <PhaseTimer phaseStartedAt={null} phaseElapsedMs={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('ticks up once per second when phaseStartedAt is set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());

    render(<PhaseTimer phaseStartedAt={Date.now() - 5_000} phaseElapsedMs={null} />);

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('0:05');

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('0:08');
  });

  it('renders a static value with no ticking when only phaseElapsedMs is set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z').getTime());

    render(<PhaseTimer phaseStartedAt={null} phaseElapsedMs={125_000} />);

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('2:05');

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('2:05');
  });
});
