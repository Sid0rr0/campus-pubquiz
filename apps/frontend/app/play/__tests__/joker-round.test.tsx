import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoubledRoundView } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import type { SessionDescription } from '@/test-utils/room-view';
import { myAnswer, seenQuestionsOf, teamLinkResult } from './test-utils';

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

/** What the team view says when round 2 counts double (a joker on it, or an extra joker). */
const DOUBLED_ROUND_2: DoubledRoundView[] = [
  { roundId: 2, roundNumber: 2, title: 'World Capitals' },
];

function mountPhone(
  myDoubledRounds: DoubledRoundView[],
  session: SessionDescription,
) {
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session,
      join: { team: JOINED_TEAM },
      game: { myDoubledRounds },
    }),
  );
}

function renderPlay(
  myDoubledRounds: DoubledRoundView[],
  session: SessionDescription,
) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  mountPhone(myDoubledRounds, session);
  const view = renderWithQuery(<PlayPage />);
  return {
    /** The phone is then sent the view for `next`. */
    moveTo(next: SessionDescription) {
      mountPhone(myDoubledRounds, next);
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
    renderPlay(DOUBLED_ROUND_2, night());

    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('borders it locked in the break', () => {
    renderPlay(
      DOUBLED_ROUND_2,
      night({ progress: { status: 'break', roundIndex: 1, revealIndex: 1 } }),
    );

    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('borders it while revealing', () => {
    renderPlay(
      DOUBLED_ROUND_2,
      night({ progress: { status: 'reveal', roundIndex: 1, revealIndex: 1 } }),
    );

    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('puts no border on a question of another round in the same block', () => {
    renderPlay(
      DOUBLED_ROUND_2,
      night({ progress: { status: 'question_open', roundIndex: 0 } }),
    );

    expect(screen.queryByTestId('joker-border')).not.toBeInTheDocument();
  });

  it('puts no border on any question without a joker', () => {
    renderPlay([], night());

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
      DOUBLED_ROUND_2,
      night({
        progress: { status: 'question_open', roundIndex: 0, questionIndex: 0 },
      }),
    );

    phone.moveTo(night({ progress: { status: 'round_intro', roundIndex: 1 } }));

    expect(screen.getByText('2× POINTS')).toBeInTheDocument();
  });

  it('does not play it when the phone loads onto the intro', () => {
    renderPlay(
      DOUBLED_ROUND_2,
      night({ progress: { status: 'round_intro', roundIndex: 1 } }),
    );

    expect(screen.queryByText('2× POINTS')).not.toBeInTheDocument();
  });

  it('does not replay it on Previous back to the intro', () => {
    const phone = renderPlay(
      DOUBLED_ROUND_2,
      night({
        progress: { status: 'question_open', roundIndex: 1, questionIndex: 0 },
      }),
    );

    phone.moveTo(night({ progress: { status: 'round_intro', roundIndex: 1 } }));

    expect(screen.queryByText('2× POINTS')).not.toBeInTheDocument();
  });

  it('does not play it for another round’s intro', () => {
    const phone = renderPlay(
      DOUBLED_ROUND_2,
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
      DOUBLED_ROUND_2,
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
      DOUBLED_ROUND_2,
      night({
        progress: { status: 'reveal_intro', roundIndex: 1, revealIndex: 1 },
      }),
    );

    expect(screen.getByTestId('joker-badge')).toBeInTheDocument();
  });

  it('shows it on the early answers title card of the joker round', () => {
    renderPlay(
      DOUBLED_ROUND_2,
      night({
        progress: { status: 'answers_intro', roundIndex: 1, revealIndex: 1 },
      }),
    );

    expect(screen.getByTestId('joker-badge')).toBeInTheDocument();
  });

  it('shows no badge on another round’s title card', () => {
    renderPlay(
      DOUBLED_ROUND_2,
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
      DOUBLED_ROUND_2,
      night({
        progress: { status: 'question_open', roundIndex: 2, questionIndex: 0 },
      }),
    );

    expect(
      screen.getByText(/^Round 2 — .* scored double$/),
    ).toBeInTheDocument();
  });

  it('does not read played while the joker round’s block is still in play', () => {
    renderPlay(DOUBLED_ROUND_2, night());

    expect(
      screen.getByText(/^Round 2 — .* scores double$/),
    ).toBeInTheDocument();
  });

  it('reads played when the quiz has ended', () => {
    renderPlay(DOUBLED_ROUND_2, night({ progress: { status: 'ended' } }));

    expect(
      screen.getByText(/^Round 2 — .* scored double$/),
    ).toBeInTheDocument();
  });
});

describe('PlayPage — the joker’s extra points on the reveal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  function renderReveal(myJokerExtras: Record<number, number>) {
    const session = night({
      progress: { status: 'reveal', roundIndex: 1, revealIndex: 1 },
    });
    window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session,
        join: { team: JOINED_TEAM },
        game: {
          myDoubledRounds: myJokerExtras[2] ? DOUBLED_ROUND_2 : [],
          myJokerExtras,
          myAnswers: {
            2: myAnswer('Paris', {
              grade: { pointsAwarded: 1, verdict: 'correct' },
            }),
          },
          seenQuestions: seenQuestionsOf(session),
        },
      }),
    );
    renderWithQuery(<PlayPage />);
  }

  it('shows the extra points next to the points in the joker round', () => {
    renderReveal({ 2: 1 });

    expect(screen.getByText(/^1 \/ \d+ points/)).toHaveTextContent('🃏 +1');
  });

  it('shows no extra points outside the joker round', () => {
    renderReveal({});

    expect(screen.getByText(/^1 \/ \d+ points/)).not.toHaveTextContent('🃏');
  });
});

describe('PlayPage — the rounds doubled for the team', () => {
  const doubled = (
    roundId: number,
    roundNumber: number,
    title: string,
  ): DoubledRoundView => ({ roundId, roundNumber, title });

  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
  });

  it('marks the joker round in the question picker’s heading, not the others', () => {
    renderPlay(DOUBLED_ROUND_2, night());

    expect(screen.getByText('World Capitals · 2×')).toBeInTheDocument();
    expect(screen.getByText('Pop Music')).toBeInTheDocument();
    expect(screen.queryByText('Pop Music · 2×')).not.toBeInTheDocument();
  });

  it('marks the heading even when the doubled round is the block’s only one', () => {
    renderPlay(
      [doubled(1, 1, 'Pop Music')],
      night({
        rounds: [
          { title: 'Pop Music', breakAfter: true, questions: [{}, {}] },
          { title: 'Sport', questions: [{}] },
        ],
        progress: { status: 'question_open', roundIndex: 0, questionIndex: 0 },
      }),
    );

    expect(screen.getByText('Pop Music · 2×')).toBeInTheDocument();
  });

  it('treats an extra joker’s round like a joker round: line, heading and border', () => {
    renderPlay(DOUBLED_ROUND_2, night());

    expect(
      screen.getByText('Round 2 — World Capitals scores double'),
    ).toBeInTheDocument();
    expect(screen.getByText('World Capitals · 2×')).toBeInTheDocument();
    expect(screen.getByTestId('joker-border')).toBeInTheDocument();
  });

  it('names both the joker round and the extra joker’s, in quiz order', () => {
    renderPlay([...DOUBLED_ROUND_2, doubled(3, 3, 'Sport')], night());

    const lines = screen.getAllByText(/^Round \d — .* scores double$/);
    expect(lines.map((line) => line.textContent)).toEqual([
      '🃏 Round 2 — World Capitals scores double',
      '🃏 Round 3 — Sport scores double',
    ]);
  });

  it('names a round bought blind by its number alone', () => {
    renderPlay([doubled(3, 3, '')], night());

    expect(screen.getByText('Round 3 scores double')).toBeInTheDocument();
  });
});
