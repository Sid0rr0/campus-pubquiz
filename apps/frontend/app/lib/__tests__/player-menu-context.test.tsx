import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PlayerMenuProvider,
  usePlayerMenu,
  usePublishPlayerMenu,
} from '@/app/lib/player-menu-context';

function Reader() {
  const playerMenu = usePlayerMenu();
  return <p>{playerMenu ? `team:${playerMenu.teamName}` : 'no team'}</p>;
}

function Publisher({
  teamName,
  onLogOut,
  onOpenSettings = () => {},
}: {
  teamName: string | null;
  onLogOut: () => void;
  onOpenSettings?: () => void;
}) {
  usePublishPlayerMenu(teamName, null, onLogOut, onOpenSettings);
  return null;
}

describe('player-menu-context', () => {
  it('reads null before any page has published a team', () => {
    render(
      <PlayerMenuProvider>
        <Reader />
      </PlayerMenuProvider>,
    );

    expect(screen.getByText('no team')).toBeInTheDocument();
  });

  it('lets a page publish its team identity for SiteHeader to read', () => {
    render(
      <PlayerMenuProvider>
        <Publisher teamName="The Quizzards" onLogOut={vi.fn()} />
        <Reader />
      </PlayerMenuProvider>,
    );

    expect(screen.getByText('team:The Quizzards')).toBeInTheDocument();
  });

  it('clears the published team once the publishing page unmounts', () => {
    const { rerender } = render(
      <PlayerMenuProvider>
        <Publisher teamName="The Quizzards" onLogOut={vi.fn()} />
        <Reader />
      </PlayerMenuProvider>,
    );
    expect(screen.getByText('team:The Quizzards')).toBeInTheDocument();

    rerender(
      <PlayerMenuProvider>
        <Reader />
      </PlayerMenuProvider>,
    );

    expect(screen.getByText('no team')).toBeInTheDocument();
  });

  it('reads null again once the team name is cleared (e.g. logging out)', () => {
    const { rerender } = render(
      <PlayerMenuProvider>
        <Publisher teamName="The Quizzards" onLogOut={vi.fn()} />
        <Reader />
      </PlayerMenuProvider>,
    );
    expect(screen.getByText('team:The Quizzards')).toBeInTheDocument();

    rerender(
      <PlayerMenuProvider>
        <Publisher teamName={null} onLogOut={vi.fn()} />
        <Reader />
      </PlayerMenuProvider>,
    );

    expect(screen.getByText('no team')).toBeInTheDocument();
  });
});
