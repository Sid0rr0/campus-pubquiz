import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { seenQuestionsOf, socketResult } from './test-utils';

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

const TEAM = {
  teamId: 'team-1',
  teamName: 'Returning Team',
  teamToken: 'team-token-1',
};

const GRADED_AT = '2024-01-01T00:00:00.000Z';

/** A single fruit question whose reveal is on air. */
const FRUIT_REVEAL = {
  rounds: [
    { questions: [{ prompt: 'Name a fruit', points: 5, answer: 'Banana' }] },
  ],
  progress: { status: 'reveal' as const, revealIndex: 0 },
};

const CIRCUITS = {
  type: 'sort' as const,
  prompt: 'Order these circuits by season.',
  points: 3,
  options: ['Imola', 'Spa', 'Silverstone'],
};

describe('PlayPage — break and reveal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  /** A phone that joined, sent the view for `session`. */
  function renderPhone(
    session: Parameters<typeof seenQuestionsOf>[0],
    hook: Record<string, unknown> = {},
  ) {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({ session, team: TEAM, ...hook }),
    );
    return renderWithQuery(<PlayPage />);
  }

  it('tells the team answering is locked during the grading break', () => {
    renderPhone({
      rounds: [{ questions: [{ prompt: 'Name a fruit' }] }],
      progress: { status: 'break' },
    });

    expect(
      screen.queryByRole('textbox', { name: /your answer/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/answering is locked/i)).toBeInTheDocument();
  });

  it('still shows the block question picker during the grading break so teams can browse back', async () => {
    renderPhone(
      {
        rounds: [
          {
            questions: [
              { prompt: 'Name a fruit' },
              { prompt: 'Name a planet' },
            ],
          },
        ],
        progress: { status: 'break', questionIndex: 1 },
      },
      { myAnswers: { 1: 'Banana', 2: 'Mars' } },
    );

    // Defaults to the block's last question, with the picker showing both.
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /question 1 \(answered\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /question 2 \(answered\)/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /question 1 \(answered\)/i }),
    );

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /your answer/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/answering is locked/i)).toBeInTheDocument();
  });

  it('shows a "look at the screen" title card for the round reveal is crossing into, not the stale top-level round title', () => {
    renderPhone({
      rounds: [
        {
          title: 'General Knowledge',
          breakAfter: false,
          questions: [{ prompt: 'Name a fruit' }],
        },
        {
          title: 'Geography',
          breakAfter: false,
          questions: [{ prompt: 'Tallest mountain?' }],
        },
        { title: 'History', questions: [{ prompt: 'Year of the Armada?' }] },
      ],
      // progress.roundIndex stays pinned to the block's last round (the
      // breakAfter round, History) throughout reveal — the card must name
      // the round at revealIndex (Geography), not fall back to that stale one.
      progress: {
        status: 'reveal_intro',
        revealIndex: 1,
        roundIndex: 2,
        questionIndex: 0,
      },
    });

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Geography' }),
    ).toBeInTheDocument();
  });

  it('shows a "look at the screen" title card for a round\'s own title while stepping back through break review', () => {
    renderPhone({
      rounds: [
        {
          title: 'General Knowledge',
          breakAfter: false,
          questions: [{ prompt: 'Name a fruit' }],
        },
        { title: 'Geography', questions: [{ prompt: 'Tallest mountain?' }] },
      ],
      progress: {
        status: 'break_round_intro',
        revealIndex: 0,
        roundIndex: 1,
        questionIndex: 0,
      },
    });

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'General Knowledge' }),
    ).toBeInTheDocument();
  });

  it('still shows the block question picker during reveal', async () => {
    renderPhone({
      rounds: [
        {
          questions: [{ prompt: 'Name a fruit' }, { prompt: 'Name a planet' }],
        },
      ],
      progress: { status: 'reveal', revealIndex: 0, questionIndex: 1 },
    });

    expect(
      screen.getByRole('button', { name: /^question 1$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^question 2$/i }),
    ).toBeInTheDocument();

    // The reveal has reached question 1 only; question 2 is not revealed yet.
    await userEvent.click(
      screen.getByRole('button', { name: /^question 2$/i }),
    );
    expect(screen.getByText(/revealing answers/i)).toBeInTheDocument();
  });

  it("shows the correct answer and the team's own submitted answer during reveal", () => {
    renderPhone(FRUIT_REVEAL, { myAnswers: { 1: 'Mango' } });

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText(/your answer/i)).toBeInTheDocument();
    expect(screen.getByText('Mango')).toBeInTheDocument();
  });

  it('shows points awarded next to YOUR ANSWER during reveal once graded', () => {
    renderPhone(FRUIT_REVEAL, {
      myAnswers: { 1: 'Mango' },
      myAnswerGrades: {
        1: { pointsAwarded: 0, gradedAt: GRADED_AT, verdict: 'incorrect' },
      },
      seenQuestions: seenQuestionsOf(FRUIT_REVEAL),
    });

    expect(screen.getByText('0 / 5 points')).toBeInTheDocument();
  });

  it('colors YOUR ANSWER green during reveal when it earned full points', () => {
    renderPhone(FRUIT_REVEAL, {
      myAnswers: { 1: 'Banana' },
      myAnswerGrades: {
        1: { pointsAwarded: 5, gradedAt: GRADED_AT, verdict: 'correct' },
      },
      seenQuestions: seenQuestionsOf(FRUIT_REVEAL),
    });

    expect(
      screen.getByText('Banana', { selector: 'p.font-display' }),
    ).toHaveClass('text-green');
  });

  it('colors YOUR ANSWER red during reveal when it earned less than full points', () => {
    renderPhone(FRUIT_REVEAL, {
      myAnswers: { 1: 'Mango' },
      myAnswerGrades: {
        1: { pointsAwarded: 0, gradedAt: GRADED_AT, verdict: 'incorrect' },
      },
      seenQuestions: seenQuestionsOf(FRUIT_REVEAL),
    });

    expect(
      screen.getByText('Mango', { selector: 'p.font-display' }),
    ).toHaveClass('text-magenta');
  });

  it('formats YOUR ANSWER for a sort/match question during reveal instead of showing the raw pipe-joined value', () => {
    renderPhone(
      {
        rounds: [
          { questions: [{ ...CIRCUITS, answer: 'Silverstone|Imola|Spa' }] },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      },
      { myAnswers: { 1: 'Imola|Spa|Silverstone' } },
    );

    expect(screen.getByText('Imola → Spa → Silverstone')).toBeInTheDocument();
    expect(screen.queryByText('Imola|Spa|Silverstone')).not.toBeInTheDocument();
  });

  it("shows the team's own order for a sort question during reveal, not the correct order", () => {
    renderPhone(
      {
        rounds: [
          { questions: [{ ...CIRCUITS, answer: 'Imola|Silverstone|Spa' }] },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      },
      { myAnswers: { 1: 'Imola|Spa|Silverstone' } },
    );

    // Each row of the reveal list shows the team's own submitted order —
    // 'Imola' is correct (index 0 matches the answer key), 'Spa' and
    // 'Silverstone' are not — never the correct-order list itself.
    expect(screen.getByText('Imola').closest('li')).toHaveClass('border-green');
    expect(screen.getByText('Spa').closest('li')).toHaveClass('border-magenta');
    expect(screen.getByText('Silverstone').closest('li')).toHaveClass(
      'border-magenta',
    );
  });

  it("shows the team's own pairing for a match question during reveal, not the correct pairing", () => {
    renderPhone(
      {
        rounds: [
          {
            questions: [
              {
                type: 'match',
                prompt: 'Match the hero to their weapon.',
                points: 4,
                options: ['arthur', 'captain america'],
                matchTargets: ['shield', 'excalibur'],
                answer: 'excalibur|shield',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      },
      // arthur -> shield (wrong, correct is excalibur), captain america -> excalibur (wrong, correct is shield)
      { myAnswers: { 1: 'shield|excalibur' } },
    );

    expect(screen.getByText('arthur').closest('li')).toHaveClass(
      'border-magenta',
    );
    expect(screen.getByText('captain america').closest('li')).toHaveClass(
      'border-magenta',
    );
  });

  it('tells the team they submitted nothing when reveal shows a question they never answered', () => {
    renderPhone(FRUIT_REVEAL, { myAnswers: {} });

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText(/no answer submitted/i)).toBeInTheDocument();
  });

  it('follows the display through the reveal walk, even overriding a question the team had browsed to', async () => {
    const revealAt = (revealIndex: number) => ({
      rounds: [
        {
          questions: [
            { prompt: 'Name a fruit' },
            { prompt: 'Name a planet' },
            { prompt: 'Name a country' },
          ],
        },
      ],
      progress: { status: 'reveal' as const, revealIndex, questionIndex: 2 },
    });
    const { rerender } = renderPhone(revealAt(0));

    // Defaults to the question at revealIndex, not the block's last question.
    expect(screen.getByText('Name a fruit')).toBeInTheDocument();

    // The team browses ahead to question 3 on their own.
    await userEvent.click(
      screen.getByRole('button', { name: /^question 3$/i }),
    );
    expect(screen.getByText('Name a country')).toBeInTheDocument();

    // The admin advances the reveal on /display to question 2 — /play snaps
    // back to follow it, discarding the team's manual browse to question 3.
    mockUseTeamLink.mockReturnValue(
      socketResult({ session: revealAt(1), team: TEAM }),
    );
    rerender(<PlayPage />);

    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.queryByText('Name a country')).not.toBeInTheDocument();
  });
});
