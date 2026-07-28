interface RoundsListQuestion {
  prompt: string;
  options?: string[];
  answer: string;
}

interface RoundsListRound {
  title: string;
  breakAfter: boolean;
  questions: RoundsListQuestion[];
}

interface RoundsListProps {
  rounds: RoundsListRound[];
}

export function RoundsList({ rounds }: RoundsListProps) {
  if (rounds.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {rounds.map((round) => (
        <li key={round.title} className="rounded-lg border border-foreground/15 p-3">
          <p className="font-extrabold">{round.title}</p>
          <ul className="ml-4 list-disc text-sm">
            {round.questions.map((question) => (
              <li key={question.prompt}>
                {question.prompt}
                {question.options && question.options.length > 0 && (
                  <p className="text-xs text-foreground/60">
                    Options: {question.options.join(', ')}
                  </p>
                )}
                <p className="text-xs font-bold text-green">Answer: {question.answer}</p>
              </li>
            ))}
          </ul>
          {round.breakAfter && (
            <p className="mt-2 text-xs font-extrabold tracking-wide text-magenta">
              Break after this round
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
