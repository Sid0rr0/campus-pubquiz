import {
  optionsAfterPurchases,
  type PurchaseView,
  type QuestionView,
} from '@campus-pubquiz/types';

/** The split Ask the room stored for the question, each option with its share; options this team's 50/50 removed are crossed out. */
export function RoomSplit({
  question,
  purchases,
}: {
  question: QuestionView;
  purchases: PurchaseView[];
}) {
  const bought = purchases.find(
    (p) => p.questionId === question.id && p.effect.kind === 'ask_the_room',
  );
  if (bought?.effect.kind !== 'ask_the_room' || !question.options) return null;
  const { split } = bought.effect;
  const left = optionsAfterPurchases(question.id, question.options, purchases);
  return (
    <div data-testid="room-split" className="text-center text-sm">
      <p className="font-semibold">Ask the room</p>
      <ul>
        {question.options.map((option) => (
          <li key={option}>
            {left.includes(option) ? <span>{option}</span> : <s>{option}</s>}{' '}
            {split[option] ?? 0}%
          </li>
        ))}
      </ul>
    </div>
  );
}
