import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { RulesContent } from '@/app/components/rules-content';

describe('RulesContent', () => {
  it('falls back to DEFAULT_SESSION_SETTINGS.rules when no rules prop is given', () => {
    render(<RulesContent />);

    for (const rule of DEFAULT_SESSION_SETTINGS.rules) {
      expect(screen.getByText(rule)).toBeInTheDocument();
    }
  });

  it('renders the injected rules array instead of the defaults', () => {
    render(<RulesContent rules={['Custom rule one.', 'Custom rule two.']} />);

    expect(screen.getByText('Custom rule one.')).toBeInTheDocument();
    expect(screen.getByText('Custom rule two.')).toBeInTheDocument();
    for (const rule of DEFAULT_SESSION_SETTINGS.rules) {
      expect(screen.queryByText(rule)).not.toBeInTheDocument();
    }
  });

  it('appends a selfie bonus explainer when "selfie" is an enabled bonus category', () => {
    render(
      <RulesContent
        rules={['House rule.']}
        enabledBonusCategories={['selfie']}
      />,
    );

    expect(screen.getByText('House rule.')).toBeInTheDocument();
    expect(screen.getByText(/Selfie bonus:/)).toBeInTheDocument();
    expect(
      screen.getByText(/tag @esn\.cut and @isc_hub\.cz/i),
    ).toBeInTheDocument();
  });

  it('appends a shot bonus explainer when "shot" is an enabled bonus category', () => {
    render(
      <RulesContent
        rules={['House rule.']}
        enabledBonusCategories={['shot']}
      />,
    );

    expect(screen.getByText(/Shot bonus:/)).toBeInTheDocument();
    expect(
      screen.getByText(/at minimum more than half your player count/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Selfie bonus:/)).not.toBeInTheDocument();
  });

  it('appends both bonus explainers when both categories are enabled', () => {
    render(
      <RulesContent
        rules={['House rule.']}
        enabledBonusCategories={['shot', 'selfie', 'custom']}
      />,
    );

    expect(screen.getByText(/Shot bonus:/)).toBeInTheDocument();
    expect(screen.getByText(/Selfie bonus:/)).toBeInTheDocument();
  });

  it('does not mention any bonus when no bonus categories are enabled', () => {
    render(<RulesContent rules={['House rule.']} />);

    expect(screen.queryByText(/Shot bonus:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selfie bonus:/)).not.toBeInTheDocument();
  });

  it('states the break interval when blocks are evenly spaced', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 3,
          topicsPerBlock: 2,
          breakRoundNumbers: [2, 4, 6],
          minQuestionsPerTopic: 5,
          maxQuestionsPerTopic: 5,
        }}
      />,
    );

    expect(
      screen.getByText(/6 topics.*break after every 2 rounds/i),
    ).toBeInTheDocument();
  });

  it('says "each round" instead of "every 1 rounds" when every round breaks', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 3,
          topicsPerBlock: 1,
          breakRoundNumbers: [1, 2, 3],
          minQuestionsPerTopic: 5,
          maxQuestionsPerTopic: 5,
        }}
      />,
    );

    expect(
      screen.getByText(/3 topics.*break after each round/i),
    ).toBeInTheDocument();
  });

  it('lists the specific round numbers when blocks are unevenly spaced', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 3,
          topicsPerBlock: null,
          breakRoundNumbers: [2, 5, 7],
          minQuestionsPerTopic: 5,
          maxQuestionsPerTopic: 5,
        }}
      />,
    );

    expect(
      screen.getByText(/7 topics.*break after round 2, 5 and 7/i),
    ).toBeInTheDocument();
  });

  it('joins a two-entry uneven list with "and" and no comma', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 2,
          topicsPerBlock: null,
          breakRoundNumbers: [1, 3],
          minQuestionsPerTopic: 5,
          maxQuestionsPerTopic: 5,
        }}
      />,
    );

    expect(screen.getByText(/break after round 1 and 3/i)).toBeInTheDocument();
  });

  it('states a single question count when every topic has the same number of questions', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 1,
          topicsPerBlock: 4,
          breakRoundNumbers: [4],
          minQuestionsPerTopic: 5,
          maxQuestionsPerTopic: 5,
        }}
      />,
    );

    expect(
      screen.getByText(/4 topics, 5 questions each, with a break/i),
    ).toBeInTheDocument();
  });

  it('says "1 question each" (singular) when every topic has exactly one question', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 1,
          topicsPerBlock: 4,
          breakRoundNumbers: [4],
          minQuestionsPerTopic: 1,
          maxQuestionsPerTopic: 1,
        }}
      />,
    );

    expect(
      screen.getByText(/4 topics, 1 question each, with a break/i),
    ).toBeInTheDocument();
  });

  it('states a question count range when topics have differing question counts', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 1,
          topicsPerBlock: 4,
          breakRoundNumbers: [4],
          minQuestionsPerTopic: 3,
          maxQuestionsPerTopic: 7,
        }}
      />,
    );

    expect(
      screen.getByText(/4 topics, 3 to 7 questions each, with a break/i),
    ).toBeInTheDocument();
  });

  it('omits the question count clause when there are no rounds', () => {
    render(
      <RulesContent
        quizStructure={{
          blockCount: 0,
          topicsPerBlock: null,
          breakRoundNumbers: [],
          minQuestionsPerTopic: 0,
          maxQuestionsPerTopic: 0,
        }}
      />,
    );

    expect(
      screen.getByText('There will be 0 topics, with a break in between.'),
    ).toBeInTheDocument();
  });
});
