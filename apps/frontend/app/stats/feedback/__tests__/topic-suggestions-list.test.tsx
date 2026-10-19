import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicSuggestionsList } from '@/app/stats/feedback/topic-suggestions-list';

describe('TopicSuggestionsList', () => {
  it('lists each topic with its count, in the order given', () => {
    render(
      <TopicSuggestionsList
        topics={[
          { topic: 'Geography', count: 4 },
          { topic: 'Film', count: 1 },
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Geography ×4');
    expect(items[1]).toHaveTextContent('Film ×1');
  });

  it('writes out an empty state when nobody suggested a topic', () => {
    render(<TopicSuggestionsList topics={[]} />);

    expect(
      screen.getByText('No topic suggestions in this range.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
