import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ClosestGuessRevealData } from '@campus-pubquiz/types';
import { ClosestGuessRevealScreen } from '@/app/components/closest-guess-reveal-screen';

const PROMPT = 'How many students attend this university?';

function renderScreen(
  closestGuess: ClosestGuessRevealData,
  correctAnswer?: string,
): void {
  render(
    <ClosestGuessRevealScreen
      prompt={PROMPT}
      correctAnswer={correctAnswer}
      closestGuess={closestGuess}
      mediaTestIdPrefix="reveal"
    />,
  );
}

describe('ClosestGuessRevealScreen', () => {
  it('shows only the question when it is sent no stats and no answer', () => {
    renderScreen({ hasSubmissions: true });

    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(/SMALLEST GUESS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HIGHEST GUESS/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ANSWER/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the smallest guess alone when only it is sent', () => {
    renderScreen({ hasSubmissions: true, minGuess: '900' });

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.queryByText(/HIGHEST GUESS/)).not.toBeInTheDocument();
  });

  it('shows both guesses, still without the answer, when the pending view has them', () => {
    renderScreen({ hasSubmissions: true, minGuess: '900', maxGuess: '2000' });

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.queryByText(/ANSWER/)).not.toBeInTheDocument();
  });

  it('adds the correct answer when it is sent, keeping the guesses', () => {
    renderScreen(
      { hasSubmissions: true, minGuess: '900', maxGuess: '2000' },
      '1000',
    );

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByText('Team B')).not.toBeInTheDocument();
  });

  it('shows the closest teams when the full view has them', () => {
    renderScreen(
      {
        hasSubmissions: true,
        minGuess: '900',
        maxGuess: '2000',
        closestGuesses: [{ teamName: 'Team B', value: '950' }],
      },
      '1000',
    );

    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
    expect(screen.getByText('950')).toBeInTheDocument();
  });

  it('shows the question and answer together when nobody guessed', () => {
    renderScreen({ hasSubmissions: false, closestGuesses: [] }, '1000');

    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
