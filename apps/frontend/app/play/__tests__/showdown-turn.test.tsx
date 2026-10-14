import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ActiveShowdownView,
  LeaderboardBoard,
  PhoneScreen,
  QuizStructureSummary,
} from '@campus-pubquiz/types';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { vibrate } from '@/app/lib/vibrate';

vi.mock('@/app/lib/vibrate', () => ({ vibrate: vi.fn() }));

const SHOWDOWN: ActiveShowdownView = {
  id: 900,
  question: 'How many people are in this room?',
  participants: [
    { teamId: 31, teamName: 'Team A', seatIndex: 0, hasGuessed: false },
    { teamId: 32, teamName: 'Team B', seatIndex: 1, hasGuessed: false },
  ],
};
const GUESSING: PhoneScreen = { kind: 'showdown_guessing' };
const LEADERBOARD: PhoneScreen = { kind: 'leaderboard' };

function renderScreens(
  phoneScreen: PhoneScreen,
  myTeamId: number | null,
  activeShowdown: ActiveShowdownView | null = SHOWDOWN,
) {
  const ui = (screen: PhoneScreen, showdown: ActiveShowdownView | null) => (
    <GameStatusScreens
      phoneScreen={screen}
      quizStructure={{} as QuizStructureSummary}
      joinCode="ABCD"
      settings={{} as never}
      activeShowdown={showdown}
      showdownRevealStep={0}
      teamName="Team A"
      myTeamId={myTeamId}
      phoneLeaderboard={{
        board: { entries: [], trends: {} } satisfies LeaderboardBoard,
        revealCount: 0,
      }}
      isConnected
      leaderboard={[]}
      onSubmitShowdownGuess={vi.fn()}
    />
  );
  const view = render(ui(phoneScreen, activeShowdown));
  return {
    moveTo: (screenKind: PhoneScreen, showdown = activeShowdown) =>
      view.rerender(ui(screenKind, showdown)),
  };
}

describe('showdown turn on the phone', () => {
  beforeEach(() => {
    vi.mocked(vibrate).mockClear();
  });

  it('shows "Your turn!" and vibrates when the showdown opens on this team', () => {
    const { moveTo } = renderScreens(LEADERBOARD, 31, null);

    moveTo(GUESSING, SHOWDOWN);

    expect(screen.getByText('Your turn!')).toBeInTheDocument();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith('turn');
  });

  it('does not vibrate when the page loads straight into the team’s turn (reconnect)', () => {
    renderScreens(GUESSING, 31);

    expect(screen.getByText('Your turn!')).toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not vibrate or say "Your turn!" on a team outside the showdown', () => {
    const { moveTo } = renderScreens(LEADERBOARD, 99, null);

    moveTo(GUESSING, SHOWDOWN);

    expect(screen.getByText('Tiebreaker in progress')).toBeInTheDocument();
    expect(screen.queryByText('Your turn!')).not.toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not vibrate again once the team has guessed', () => {
    const { moveTo } = renderScreens(LEADERBOARD, 31, null);
    moveTo(GUESSING, SHOWDOWN);
    vi.mocked(vibrate).mockClear();

    moveTo(GUESSING, {
      ...SHOWDOWN,
      participants: [
        { ...SHOWDOWN.participants[0], hasGuessed: true },
        SHOWDOWN.participants[1],
      ],
    });

    expect(screen.queryByText('Your turn!')).not.toBeInTheDocument();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
