import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamJoker } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import type { SessionDescription } from '@/test-utils/room-view';
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

const JOINED_TEAM = {
  teamId: 1,
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'CODE',
};

/** Round 1 (id 1) and round 2 (id 2) share a block; round 3 (id 3) follows a break. */
function night(
  overrides: Partial<SessionDescription> = {},
): SessionDescription {
  return {
    rounds: [
      { title: 'Pop Music', breakAfter: false, questions: [{}] },
      { title: 'World Capitals', questions: [{}, {}] },
      { title: 'Sport', questions: [{}] },
    ],
    settings: { showRoundOverview: true, jokersEnabled: true },
    // The block's second question (round 2's first) is the furthest opened.
    progress: {
      status: 'question_open',
      roundIndex: 1,
      questionIndex: 0,
      furthestOpenIndex: 1,
    },
    ...overrides,
  };
}

const JOKER_ON_ROUND_2: TeamJoker = { roundId: 2, source: 'chosen' };

function mountPhone(myJoker: TeamJoker | null, session: SessionDescription) {
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({ session, join: { team: JOINED_TEAM }, game: { myJoker } }),
  );
}

function renderPlay(myJoker: TeamJoker | null, session: SessionDescription) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mountPhone(myJoker, session);
  const view = renderWithQuery(<PlayPage />);
  return {
    /** The phone is then sent the view for `next`. */
    moveTo(next: SessionDescription) {
      mountPhone(myJoker, next);
      view.rerender(<PlayPage />);
    },
  };
}

describe('PlayPage — the joker border', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('borders a joker-round question while answering', () => {
    renderPlay(JOKER_ON_ROUND_2, night());

    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('borders it locked in the break', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({ progress: { status: 'break', roundIndex: 1, revealIndex: 1 } }),
    );

    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('borders it while revealing', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({ progress: { status: 'reveal', roundIndex: 1, revealIndex: 1 } }),
    );

    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('puts no border on a question of another round in the same block', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({ progress: { status: 'question_open', roundIndex: 0 } }),
    );

    expect(screen.queryByTestId('joker-border')).not.toBeInTheDocument();
  });

  it('puts no border on any question without a joker', () => {
    renderPlay(null, night());

    expect(screen.queryByTestId('joker-border')).not.toBeInTheDocument();
  });
});

describe('PlayPage — the joker round title cards', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('plays the 2× POINTS card when the joker round’s intro comes on live', () => {
    const phone = renderPlay(
      JOKER_ON_ROUND_2,
      night({
        progress: { status: 'question_open', roundIndex: 0, questionIndex: 0 },
      }),
    );

    phone.moveTo(night({ progress: { status: 'round_intro', roundIndex: 1 } }));

    expect(screen.getByText('2× POINTS')).toBeInTheDocument();
  });

  it('does not play it when the phone loads onto the intro', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({ progress: { status: 'round_intro', roundIndex: 1 } }),
    );

    expect(screen.queryByText('2× POINTS')).not.toBeInTheDocument();
  });

  it('does not replay it on Previous back to the intro', () => {
    const phone = renderPlay(
      JOKER_ON_ROUND_2,
      night({
        progress: { status: 'question_open', roundIndex: 1, questionIndex: 0 },
      }),
    );

    phone.moveTo(night({ progress: { status: 'round_intro', roundIndex: 1 } }));

    expect(screen.queryByText('2× POINTS')).not.toBeInTheDocument();
  });

  it('does not play it for another round’s intro', () => {
    const phone = renderPlay(
      JOKER_ON_ROUND_2,
      night({ progress: { status: 'round_intro', roundIndex: 0 } }),
    );
    phone.moveTo(
      night({
        progress: { status: 'question_open', roundIndex: 0, questionIndex: 0 },
      }),
    );
    phone.moveTo(night({ progress: { status: 'round_intro', roundIndex: 2 } }));

    expect(screen.queryByText('2× POINTS')).not.toBeInTheDocument();
  });

  it('shows a static joker badge on the break round intro of the joker round', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({
        progress: {
          status: 'break_round_intro',
          roundIndex: 1,
          revealIndex: 1,
        },
      }),
    );

    expect(screen.getByTestId('joker-badge')).toBeInTheDocument();
  });

  it('shows it on the reveal intro of the joker round', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({
        progress: { status: 'reveal_intro', roundIndex: 1, revealIndex: 1 },
      }),
    );

    expect(screen.getByTestId('joker-badge')).toBeInTheDocument();
  });

  it('shows no badge on another round’s title card', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({
        progress: { status: 'reveal_intro', roundIndex: 1, revealIndex: 0 },
      }),
    );

    expect(screen.queryByTestId('joker-badge')).not.toBeInTheDocument();
  });
});

describe('PlayPage — the joker chip once played', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('reads played once the joker round’s block has been revealed', () => {
    renderPlay(
      JOKER_ON_ROUND_2,
      night({
        progress: { status: 'question_open', roundIndex: 2, questionIndex: 0 },
      }),
    );

    expect(
      screen.getByRole('button', { name: /🃏 R2.*played/ }),
    ).toBeInTheDocument();
  });

  it('does not read played while the joker round’s block is still in play', () => {
    renderPlay(JOKER_ON_ROUND_2, night());

    expect(screen.getByRole('button', { name: /🃏 R2/ })).not.toHaveTextContent(
      /played/,
    );
  });

  it('reads played when the quiz has ended', () => {
    renderPlay(JOKER_ON_ROUND_2, night({ progress: { status: 'ended' } }));

    expect(
      screen.getByRole('button', { name: /🃏 R2.*played/ }),
    ).toBeInTheDocument();
  });
});
