import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
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

const TEAM = { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' };

describe('PlayPage — a Clue question', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
  });

  it('lists the clues shown so far under the prompt', () => {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'clues',
                  prompt: 'Who am I?',
                  options: ['Vague', 'Sharper', 'Giveaway'],
                  points: 1.5,
                },
              ],
            },
          ],
          progress: { status: 'question_open' },
          clueStep: 1,
          highestClueShown: { 1: 2 },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Who am I?')).toBeInTheDocument();
    expect(screen.getByText('Vague')).toBeInTheDocument();
    expect(screen.getByText('Sharper')).toBeInTheDocument();
    expect(screen.queryByText('Giveaway')).not.toBeInTheDocument();
  });

  const clueSession = (clueStep: number, highest: number) => ({
    rounds: [
      {
        questions: [
          {
            type: 'clues' as const,
            prompt: 'Who am I?',
            options: ['Vague', 'Sharper', 'Giveaway'],
            points: 1.5,
          },
        ],
      },
    ],
    progress: { status: 'question_open' as const },
    clueStep,
    highestClueShown: { 1: highest },
  });

  it('shows what an answer is worth now and warns that the next clue freezes it', () => {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({ session: clueSession(1, 2), join: { team: TEAM } }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Worth 1 points now')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Once the next clue is shown, you can't change this answer.",
      ),
    ).toBeInTheDocument();
  });

  it('gives no warning on the last clue', () => {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({ session: clueSession(2, 3), join: { team: TEAM } }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Worth 0.5 points now')).toBeInTheDocument();
    expect(screen.queryByText(/can't change this answer/)).toBeNull();
  });

  it('says on the reveal which clue the team answered on', () => {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'clues',
                  prompt: 'Who am I?',
                  answer: 'Marie Curie',
                  options: ['Vague', 'Sharper', 'Giveaway'],
                  points: 1.5,
                },
              ],
            },
          ],
          progress: { status: 'reveal', revealIndex: 0 },
        },
        join: { team: TEAM },
        game: {
          myAnswers: { 1: 'Marie Curie' },
          myAnswerClues: { 1: { clue: 2, value: 1 } },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('You answered on clue 2')).toBeInTheDocument();
  });

  it('shows an answer frozen by a newer clue read-only', () => {
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: clueSession(1, 2),
        join: { team: TEAM },
        game: {
          myAnswers: { 1: 'Curie' },
          myAnswerClues: { 1: { clue: 1, value: 1.5 } },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(
      screen.getByText(/Locked in on clue 1 · worth\s+1.5 points/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
