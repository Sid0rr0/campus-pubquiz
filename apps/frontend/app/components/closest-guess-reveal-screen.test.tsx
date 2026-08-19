import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ClosestGuessRevealData } from '@campus-pubquiz/types';
import { ClosestGuessRevealScreen } from '@/app/components/closest-guess-reveal-screen';

const WITH_SUBMISSIONS: ClosestGuessRevealData = {
  hasSubmissions: true,
  minGuess: '900',
  maxGuess: '2000',
  closestGuesses: [{ teamName: 'Team B', value: '950' }],
};

describe('ClosestGuessRevealScreen', () => {
  it('shows only the question at step 0', () => {
    render(
      <ClosestGuessRevealScreen
        prompt="How many students attend this university?"
        step={0}
        correctAnswer="1000"
        closestGuess={WITH_SUBMISSIONS}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(
      screen.getByText('How many students attend this university?'),
    ).toBeInTheDocument();
    expect(screen.queryByText('900')).not.toBeInTheDocument();
    expect(screen.queryByText('2000')).not.toBeInTheDocument();
    expect(screen.queryByText('1000')).not.toBeInTheDocument();
    expect(screen.queryByText('Team B')).not.toBeInTheDocument();
  });

  it('adds the smallest guess, anonymously, at step 1, keeping the question visible', () => {
    render(
      <ClosestGuessRevealScreen
        prompt="How many students attend this university?"
        step={1}
        correctAnswer="1000"
        closestGuess={WITH_SUBMISSIONS}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.queryByText('2000')).not.toBeInTheDocument();
    expect(screen.queryByText('1000')).not.toBeInTheDocument();
  });

  it('adds the highest guess at step 2, keeping the smallest guess visible', () => {
    render(
      <ClosestGuessRevealScreen
        prompt="How many students attend this university?"
        step={2}
        correctAnswer="1000"
        closestGuess={WITH_SUBMISSIONS}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.queryByText('1000')).not.toBeInTheDocument();
  });

  it('adds the correct answer at step 3, keeping the guesses visible', () => {
    render(
      <ClosestGuessRevealScreen
        prompt="How many students attend this university?"
        step={3}
        correctAnswer="1000"
        closestGuess={WITH_SUBMISSIONS}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByText('Team B')).not.toBeInTheDocument();
  });

  it('adds the closest team(s) at step 4, keeping everything else visible', () => {
    render(
      <ClosestGuessRevealScreen
        prompt="How many students attend this university?"
        step={4}
        correctAnswer="1000"
        closestGuess={WITH_SUBMISSIONS}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Team B')).toBeInTheDocument();
    expect(screen.getByText('950')).toBeInTheDocument();
  });

  it('shows the question + correct answer together immediately when nobody submitted a guess, regardless of step', () => {
    render(
      <ClosestGuessRevealScreen
        prompt="How many students attend this university?"
        step={0}
        correctAnswer="1000"
        closestGuess={{ hasSubmissions: false, closestGuesses: [] }}
        mediaTestIdPrefix="reveal"
      />,
    );

    expect(
      screen.getByText('How many students attend this university?'),
    ).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });
});
