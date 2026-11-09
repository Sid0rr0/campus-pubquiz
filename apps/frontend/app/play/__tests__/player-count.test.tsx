import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { PlayerCountCard } from '@/app/play/player-count-card';
import { SettingsModal } from '@/app/play/settings-modal';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TEAM = { teamId: 'team-1', teamName: 'The Quizzards', teamToken: 't' };
const OK = { success: true } as const;

/** A joined phone on `status`, whose team has reported `myPlayerCount` players (null: none yet). */
function renderPhone({
  status,
  myPlayerCount,
  setPlayerCount = vi.fn().mockResolvedValue(OK),
}: {
  status: 'lobby' | 'rules';
  myPlayerCount: number | null;
  setPlayerCount?: ReturnType<typeof vi.fn>;
}) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session: { progress: { status } },
      join: { team: TEAM },
      game: { myPlayerCount, setPlayerCount },
    }),
  );
  renderWithQuery(<PlayPage />);
  return { setPlayerCount };
}

const shown = () => screen.getByRole('status', { name: /number of players/i });

describe('PlayPage — the lobby player count card', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('asks how many players, next to the existing lobby content', () => {
    renderPhone({ status: 'lobby', myPlayerCount: null });

    expect(
      screen.getByText(/how many players does your team have/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/you're in!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/look for The Quizzards on the big screen/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/waiting for the quiz to start/i)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /read the rules/i }),
    ).toBeInTheDocument();
  });

  it('keeps the stepper between 1 and 20', async () => {
    renderPhone({ status: 'lobby', myPlayerCount: null });
    const fewer = screen.getByRole('button', { name: /fewer players/i });
    const more = screen.getByRole('button', { name: /more players/i });

    for (let tap = 0; tap < 30; tap += 1) await userEvent.click(fewer);
    expect(shown()).toHaveTextContent('1');
    expect(fewer).toBeDisabled();

    for (let tap = 0; tap < 30; tap += 1) await userEvent.click(more);
    expect(shown()).toHaveTextContent('20');
    expect(more).toBeDisabled();
  });

  it('sends the chosen number and shows "Saved ✓" once the server acknowledges it', async () => {
    const { setPlayerCount } = renderPhone({
      status: 'lobby',
      myPlayerCount: null,
    });
    await userEvent.click(
      screen.getByRole('button', { name: /more players/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /more players/i }),
    );

    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    // The stepper starts at 4 when nothing was reported yet.
    expect(setPlayerCount).toHaveBeenCalledExactlyOnceWith(6);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('offers a retry when the server refuses the count', async () => {
    const { setPlayerCount } = renderPhone({
      status: 'lobby',
      myPlayerCount: null,
      setPlayerCount: vi
        .fn()
        .mockResolvedValueOnce({ success: false, error: 'Nope' })
        .mockResolvedValueOnce(OK),
    });

    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(setPlayerCount).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('collapses to "(n) players · edit" once a count is saved, and edit reopens the card', async () => {
    renderPhone({ status: 'lobby', myPlayerCount: 4 });

    expect(
      screen.queryByText(/how many players does your team have/i),
    ).not.toBeInTheDocument();
    const edit = screen.getByRole('button', { name: /4 players · edit/i });

    await userEvent.click(edit);

    expect(
      screen.getByText(/how many players does your team have/i),
    ).toBeInTheDocument();
    expect(shown()).toHaveTextContent('4');
  });

  it('says "1 player" for a single player', () => {
    renderPhone({ status: 'lobby', myPlayerCount: 1 });

    expect(
      screen.getByRole('button', { name: /1 player · edit/i }),
    ).toBeInTheDocument();
  });
});

describe('PlayPage — a team that joins after the lobby', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('is asked once, over whatever screen it lands on', () => {
    renderPhone({ status: 'rules', myPlayerCount: null });

    expect(
      screen.getByText(/how many players does your team have/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
  });

  it('never sees the card when its team already has a count', () => {
    renderPhone({ status: 'rules', myPlayerCount: 5 });

    expect(
      screen.queryByText(/how many players does your team have/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /later/i }),
    ).not.toBeInTheDocument();
  });

  it('is not asked after a reload mid-quiz when it joined in the lobby without a count', () => {
    renderPhone({ status: 'lobby', myPlayerCount: null });
    cleanup();

    renderPhone({ status: 'rules', myPlayerCount: null });

    expect(
      screen.queryByText(/how many players does your team have/i),
    ).not.toBeInTheDocument();
  });

  it('is asked again after a reload until it answers or taps Later', () => {
    renderPhone({ status: 'rules', myPlayerCount: null });
    cleanup();

    renderPhone({ status: 'rules', myPlayerCount: null });

    expect(
      screen.getByText(/how many players does your team have/i),
    ).toBeInTheDocument();
  });

  it('folds the card to the bottom on Later, and keeps it folded after a reload', async () => {
    renderPhone({ status: 'rules', myPlayerCount: null });

    await userEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(
      screen.queryByText(/how many players does your team have/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /how many players\? · add/i })
        .parentElement,
    ).toHaveClass('order-5');

    cleanup();
    renderPhone({ status: 'rules', myPlayerCount: null });
    expect(
      screen.queryByText(/how many players does your team have/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /how many players\? · add/i }),
    ).toBeInTheDocument();
  });

  it('reopens the folded card at the bottom, where Later folds it again', async () => {
    renderPhone({ status: 'rules', myPlayerCount: null });
    await userEvent.click(screen.getByRole('button', { name: /later/i }));

    await userEvent.click(
      screen.getByRole('button', { name: /how many players\? · add/i }),
    );
    expect(
      screen
        .getByRole('heading', { name: /how many players/i })
        .closest('.order-5'),
    ).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /later/i }));
    expect(
      screen.getByRole('button', { name: /how many players\? · add/i }),
    ).toBeInTheDocument();
  });

  it('still works when localStorage is unavailable', async () => {
    const setItem = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation((key) => {
        if (key.includes('player-count')) throw new Error('blocked');
      });
    const getItem = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation((key) => {
        if (key.includes('player-count')) throw new Error('blocked');
        return key === 'campus-pubquiz-team-name' ? 'The Quizzards' : null;
      });
    renderPhone({ status: 'rules', myPlayerCount: null });

    await userEvent.click(screen.getByRole('button', { name: /later/i }));

    expect(
      screen.queryByText(/how many players does your team have/i),
    ).not.toBeInTheDocument();
    setItem.mockRestore();
    getItem.mockRestore();
  });
});

describe('PlayPage — where the answered card lives', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('sits below the rest of the lobby screen', () => {
    renderPhone({ status: 'lobby', myPlayerCount: 4 });

    const rules = screen.getByRole('link', { name: /read the rules/i });
    const line = screen.getByRole('button', { name: /4 players · edit/i });
    expect(
      rules.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('asks a late joiner above its screen, and folds below it once answered', async () => {
    renderPhone({ status: 'rules', myPlayerCount: null });
    expect(
      screen.getByRole('heading', { name: /how many players/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    const line = await screen.findByRole(
      'button',
      { name: /4 players · edit/i },
      { timeout: 3000 },
    );
    expect(line.parentElement).toHaveClass('order-5');
  });

  it('shows one card when a late joiner is stepped back to the lobby', () => {
    renderPhone({ status: 'rules', myPlayerCount: null });
    cleanup();

    renderPhone({ status: 'lobby', myPlayerCount: null });

    expect(
      screen.getAllByRole('heading', { name: /how many players/i }),
    ).toHaveLength(1);
  });
});

describe('PlayerCountCard — a count saved while the card is open', () => {
  function renderCard(onSend = vi.fn().mockResolvedValue(OK)) {
    const bottomSlot = document.body.appendChild(document.createElement('div'));
    const props = { onSend, bottomSlot };
    const view = render(<PlayerCountCard savedCount={null} {...props} />);
    return {
      bottomSlot,
      setSavedCount: (savedCount: number) =>
        view.rerender(<PlayerCountCard savedCount={savedCount} {...props} />),
    };
  }

  it('folds to the bottom slot when the count comes from elsewhere', () => {
    const { bottomSlot, setSavedCount } = renderCard();

    setSavedCount(6);

    expect(bottomSlot).toHaveTextContent('6 players · edit');
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
  });

  it('stays open while this phone is editing, in the bottom slot', async () => {
    const { bottomSlot, setSavedCount } = renderCard();
    setSavedCount(6);
    await userEvent.click(screen.getByRole('button', { name: /6 players/i }));

    setSavedCount(7);

    expect(bottomSlot).toContainElement(
      screen.getByRole('button', { name: /send/i }),
    );
    expect(shown()).toHaveTextContent('6');
  });

  it('stays open for a retry when an edit is refused', async () => {
    const { setSavedCount } = renderCard(
      vi.fn().mockResolvedValue({ success: false, error: 'Nope' }),
    );
    setSavedCount(6);
    await userEvent.click(screen.getByRole('button', { name: /6 players/i }));

    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
    expect(
      screen.getByRole('heading', { name: /how many players/i }),
    ).toBeInTheDocument();
  });

  it('still shows "Saved ✓" when the server sync beats the acknowledgement', async () => {
    let acknowledge: (result: typeof OK) => void = () => undefined;
    const { setSavedCount } = renderCard(
      vi.fn(
        () =>
          new Promise((resolve) => {
            acknowledge = resolve;
          }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    setSavedCount(4);
    acknowledge(OK);

    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('goes back to asking when the send is refused', async () => {
    renderCard(vi.fn().mockResolvedValue({ success: false, error: 'Nope' }));

    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
    expect(
      screen.getByRole('heading', { name: /how many players/i }),
    ).toBeInTheDocument();
  });
});

describe('SettingsModal — the player count field', () => {
  it('shows the current count and sends a change', async () => {
    const onPlayerCountChange = vi.fn().mockResolvedValue(OK);
    render(
      <SettingsModal
        isOpen={true}
        onOpenChange={vi.fn()}
        autoAdvanceEnabled={true}
        onAutoAdvanceChange={vi.fn()}
        playerCount={4}
        onPlayerCountChange={onPlayerCountChange}
      />,
    );
    expect(shown()).toHaveTextContent('4');

    await userEvent.click(
      screen.getByRole('button', { name: /more players/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(onPlayerCountChange).toHaveBeenCalledWith(5);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
  });
});
