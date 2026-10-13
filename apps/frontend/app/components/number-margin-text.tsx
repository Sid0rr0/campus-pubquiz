import {
  formatMarginText,
  gradingSettingsOf,
  type GradingSettingsSource,
} from '@campus-pubquiz/types';

/** How precise a Number question's answer must be; the phone and the big screen both render this one text. Renders nothing for a type with no margin. */
export function NumberMarginText({
  question,
  className,
}: {
  question: GradingSettingsSource;
  className?: string;
}) {
  const { margin } = gradingSettingsOf(question);
  if (!margin) return null;
  return <p className={className}>{formatMarginText(margin)}</p>;
}
