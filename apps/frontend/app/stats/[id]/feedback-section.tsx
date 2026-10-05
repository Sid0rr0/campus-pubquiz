import type { SessionDetailFeedback } from '@campus-pubquiz/types';

interface FeedbackSectionProps {
  feedback: SessionDetailFeedback;
}

/** Teams' comments and topic suggestions — anonymous, so nothing here names a team. */
export function FeedbackSection({ feedback }: FeedbackSectionProps) {
  if (!feedback.collected) {
    return (
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Feedback</h2>
        <p className="text-foreground/60">Feedback was off for this session</p>
      </section>
    );
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Comments</h2>
        {feedback.comments.length === 0 ? (
          <p className="text-foreground/60">No comments yet.</p>
        ) : (
          <ul aria-label="Comments" className="flex flex-col gap-2">
            {feedback.comments.map((comment) => (
              <li
                key={`${comment.submittedAt}-${comment.text}`}
                className="rounded-md border border-foreground/10 px-4 py-2"
              >
                <p className="whitespace-pre-wrap break-words">
                  {comment.text}
                </p>
                <p className="text-xs text-foreground/50">
                  {new Date(comment.submittedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg">Topic suggestions</h2>
        {feedback.topics.length === 0 ? (
          <p className="text-foreground/60">No topic suggestions yet.</p>
        ) : (
          <ul aria-label="Topic suggestions" className="flex flex-col gap-1">
            {feedback.topics.map(({ topic, count }) => (
              <li key={topic}>{`${topic} ×${count}`}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
