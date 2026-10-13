import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { JoinPanel } from '@/app/components/join-panel';
import { renderWithQuery } from '@/test-utils/query';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, mockFetchPublicSessions } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  mockFetchPublicSessions: vi.fn(),
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/app/lib/sessions-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/sessions-api')>();
  return { ...actual, fetchPublicSessions: mockFetchPublicSessions };
});

const JOINED_TEAM = {
  teamId: 1,
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'QUICK-JADE-FOX',
};

function saveTeamName() {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
}

/** The join form's team name field is on screen. */
function isJoinFormShown() {
  return screen.queryByRole('textbox', { name: /team name/i }) !== null;
}

describe('the join gate on /play and the home page join panel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockFetchPublicSessions.mockReset();
    mockFetchPublicSessions.mockResolvedValue([]);
  });

  const cases: ReadonlyArray<{
    name: string;
    setup: () => Parameters<typeof teamLinkResult>[0];
    isFormExpected: boolean;
  }> = [
    {
      name: 'no team name',
      setup: () => ({ session: {} }),
      isFormExpected: true,
    },
    {
      name: 'a restored team name with no game to reconnect to and no view',
      setup: () => {
        saveTeamName();
        return { join: { activeJoinCode: null } };
      },
      isFormExpected: true,
    },
    {
      name: 'a connection error and no team',
      setup: () => {
        saveTeamName();
        return { session: {}, join: { connectionError: 'Unknown game' } };
      },
      isFormExpected: true,
    },
    {
      name: 'a team name reconnecting to a game',
      setup: () => {
        saveTeamName();
        return {};
      },
      isFormExpected: false,
    },
    {
      name: 'a joined team with a view',
      setup: () => {
        saveTeamName();
        return { session: {}, join: { team: JOINED_TEAM } };
      },
      isFormExpected: false,
    },
    {
      name: 'the Team link saying the join form is needed, whatever else is set',
      setup: () => {
        saveTeamName();
        return {
          session: {},
          join: { team: JOINED_TEAM, needsJoinForm: true },
        };
      },
      isFormExpected: true,
    },
  ];

  describe.each(cases)('$name', ({ setup, isFormExpected }) => {
    it('decides the same on /play', () => {
      mockUseTeamLink.mockReturnValue(teamLinkResult(setup()));

      renderWithQuery(<PlayPage />);

      expect(isJoinFormShown()).toBe(isFormExpected);
    });

    it('decides the same on the home page join panel', () => {
      mockUseTeamLink.mockReturnValue(teamLinkResult(setup()));

      renderWithQuery(<JoinPanel codeFromUrl="" />);

      expect(isJoinFormShown()).toBe(isFormExpected);
    });
  });
});
