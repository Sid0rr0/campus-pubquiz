import { formatMarginText, type QuestionView } from '@campus-pubquiz/types';

/** How precise an answer must be; the phone and the big screen both render this one text. Reads the margin off the view, which carries one only for a type that has it, and renders nothing otherwise. */
export function NumberMarginText({
  question,
  className,
}: {
  question: Pick<QuestionView, 'margin'>;
  className?: string;
}) {
  if (!question.margin) return null;
  return <p className={className}>{formatMarginText(question.margin)}</p>;
}
