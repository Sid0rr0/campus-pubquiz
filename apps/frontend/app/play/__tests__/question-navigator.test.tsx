import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { socketResult } from './test-utils';

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

// The builder numbers questions 1, 2, 3 across the quiz, as the server does.
const FRUIT = { prompt: 'Name a fruit' };
const PLANET = { prompt: 'Name a planet' };
const COUNTRY = { prompt: 'Name a country' };

describe('PlayPage — question navigator', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  it('shows a navigator for revealed block questions with answered questions marked', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        session: {
          rounds: [{ questions: [FRUIT, PLANET] }],
          progress: { status: 'question_open', questionIndex: 1 },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        myAnswers: { 1: 'Banana' },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByRole('button', { name: /question 1 \(answered\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^question 2$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Name a planet')).toBeInTheDocument();
  });

  it('shows the whole round as disabled slots in the picker, not just the next question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        session: {
          rounds: [{ questions: [FRUIT, PLANET, COUNTRY] }],
          progress: { status: 'question_open' },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    const upcomingButton2 = screen.getByRole('button', {
      name: /question 2 \(not open yet\)/i,
    });
    const upcomingButton3 = screen.getByRole('button', {
      name: /question 3 \(not open yet\)/i,
    });
    expect(upcomingButton2).toBeDisabled();
    expect(upcomingButton3).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /^question 1$/i }),
    ).not.toBeDisabled();
  });

  it('restarts question numbering from 1 for each round in the picker', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        session: {
          rounds: [
            { breakAfter: false, questions: [FRUIT, PLANET] },
            { questions: [COUNTRY] },
          ],
          progress: {
            status: 'question_open',
            roundIndex: 1,
            furthestOpenIndex: 2,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByRole('navigation', { name: /round 1 questions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: /round 2 questions/i }),
    ).toBeInTheDocument();
    // Two separate "Question 1" buttons — one per round, each numbered from 1.
    expect(
      screen.getAllByRole('button', { name: /^question 1$/i }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: /^question 2$/i }),
    ).toBeInTheDocument();
  });

  it('lets the team browse back to an earlier open question and revise its answer', async () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    const submitAnswer = vi.fn();
    mockUseTeamLink.mockReturnValue(
      socketResult({
        session: {
          rounds: [{ questions: [FRUIT, PLANET] }],
          progress: { status: 'question_open', questionIndex: 1 },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
        submitAnswer,
        myAnswers: { 1: 'Banana' },
      }),
    );
    renderWithQuery(<PlayPage />);

    await userEvent.click(
      screen.getByRole('button', { name: /question 1 \(answered\)/i }),
    );

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /your answer/i })).toHaveValue(
      'Banana',
    );

    await userEvent.clear(
      screen.getByRole('textbox', { name: /your answer/i }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /your answer/i }),
      'Apple',
    );
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(submitAnswer).toHaveBeenCalledWith(1, 'team-1', 'Apple');
  });

  it('keeps showing the furthest-opened question when the display steps PREVIOUS', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      socketResult({
        // The admin hit PREVIOUS on /display: progress/currentQuestion step
        // back to q1, but furthestOpenIndex (and so blockQuestions) still
        // reflects q2 as the latest question ever opened.
        session: {
          rounds: [{ questions: [FRUIT, PLANET] }],
          progress: {
            status: 'question_open',
            questionIndex: 0,
            furthestOpenIndex: 1,
          },
        },
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a planet')).toBeInTheDocument();
    expect(screen.queryByText('Name a fruit')).not.toBeInTheDocument();
  });
});
