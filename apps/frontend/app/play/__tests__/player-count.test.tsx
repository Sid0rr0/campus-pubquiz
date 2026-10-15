import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
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

    expect(screen.getByText(/how many players are you/i)).toBeInTheDocument();
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
      screen.queryByText(/how many players are you/i),
    ).not.toBeInTheDocument();
    const edit = screen.getByRole('button', { name: /4 players · edit/i });

    await userEvent.click(edit);

    expect(screen.getByText(/how many players are you/i)).toBeInTheDocument();
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

    expect(screen.getByText(/how many players are you/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /dismiss/i }),
    ).toBeInTheDocument();
  });

  it('never sees the card when its team already has a count', () => {
    renderPhone({ status: 'rules', myPlayerCount: 5 });

    expect(
      screen.queryByText(/how many players are you/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /dismiss/i }),
    ).not.toBeInTheDocument();
  });

  it('is not asked after a reload mid-quiz when it joined in the lobby without a count', () => {
    renderPhone({ status: 'lobby', myPlayerCount: null });
    cleanup();

    renderPhone({ status: 'rules', myPlayerCount: null });

    expect(
      screen.queryByText(/how many players are you/i),
    ).not.toBeInTheDocument();
  });

  it('is asked again after a reload until it answers or dismisses', () => {
    renderPhone({ status: 'rules', myPlayerCount: null });
    cleanup();

    renderPhone({ status: 'rules', myPlayerCount: null });

    expect(screen.getByText(/how many players are you/i)).toBeInTheDocument();
  });

  it('hides the card for good on this phone once dismissed', async () => {
    renderPhone({ status: 'rules', myPlayerCount: null });

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(
      screen.queryByText(/how many players are you/i),
    ).not.toBeInTheDocument();

    renderPhone({ status: 'rules', myPlayerCount: null });
    expect(
      screen.queryByText(/how many players are you/i),
    ).not.toBeInTheDocument();
  });

  it('still works when localStorage is unavailable', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key) => {
        if (key.includes('player-count')) throw new Error('blocked');
      });
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) => {
        if (key.includes('player-count')) throw new Error('blocked');
        return key === 'campus-pubquiz-team-name' ? 'The Quizzards' : null;
      });
    renderPhone({ status: 'rules', myPlayerCount: null });

    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(
      screen.queryByText(/how many players are you/i),
    ).not.toBeInTheDocument();
    setItem.mockRestore();
    getItem.mockRestore();
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
