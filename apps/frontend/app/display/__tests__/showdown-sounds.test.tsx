import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { DisplayShowdown } from '@/app/display/display-showdown';
import { displaySounds } from '@/app/lib/display-sounds';

vi.mock('@/app/lib/display-sounds', () => ({
  displaySounds: { play: vi.fn() },
}));

const ROUND: ActiveShowdownView = {
  id: 900,
  question: 'How many people are in this room?',
  participants: [
    {
      teamId: 31,
      teamName: 'Team A',
      seatIndex: 0,
      hasGuessed: true,
      guess: '40',
    },
    {
      teamId: 32,
      teamName: 'Team B',
      seatIndex: 1,
      hasGuessed: true,
      guess: '50',
    },
  ],
};
const DECIDED: ActiveShowdownView = {
  ...ROUND,
  answer: '42',
  winnerTeamId: 31,
  isTie: false,
};

function renderAt(step: number, round = ROUND) {
  const view = render(<DisplayShowdown activeShowdown={round} step={step} />);
  return {
    moveTo: (nextStep: number, nextRound = round) =>
      view.rerender(
        <DisplayShowdown activeShowdown={nextRound} step={nextStep} />,
      ),
  };
}

describe('DisplayShowdown sounds', () => {
  beforeEach(() => {
    vi.mocked(displaySounds.play).mockClear();
  });

  it('slams each guess in with a sound when the step moves forward', () => {
    const { moveTo } = renderAt(0);

    moveTo(1);
    moveTo(2);

    expect(displaySounds.play).toHaveBeenCalledTimes(2);
    expect(displaySounds.play).toHaveBeenCalledWith('slam');
  });

  it('plays the burst, not a slam, when the winner is revealed', () => {
    const { moveTo } = renderAt(2);

    moveTo(3, DECIDED);

    expect(displaySounds.play).toHaveBeenCalledTimes(1);
    expect(displaySounds.play).toHaveBeenCalledWith('burst');
  });

  it('is silent when loaded mid-reveal (reload or reconnect)', () => {
    renderAt(2);

    expect(displaySounds.play).not.toHaveBeenCalled();
  });

  it('is silent when the quiz master presses Previous', () => {
    const { moveTo } = renderAt(2);

    moveTo(1);

    expect(displaySounds.play).not.toHaveBeenCalled();
  });
});
