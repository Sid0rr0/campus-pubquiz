import type { FeedbackTrends } from '@campus-pubquiz/types';

interface TopicSuggestionsListProps {
  topics: FeedbackTrends['topics'];
}

/** Topic suggestions from every session in the range, most asked-for first ("Geography ×4"). */
export function TopicSuggestionsList({ topics }: TopicSuggestionsListProps) {
  if (topics.length === 0) {
    return (
      <p className="text-foreground/50">No topic suggestions in this range.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {topics.map(({ topic, count }) => (
        <li key={topic.toLowerCase()}>
          {topic} ×{count}
        </li>
      ))}
    </ul>
  );
}
