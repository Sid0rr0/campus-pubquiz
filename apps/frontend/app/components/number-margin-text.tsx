import {
  DEFAULT_MARGIN,
  formatMarginText,
  type Margin,
} from '@campus-pubquiz/types';

/** How precise a Number question's answer must be; the phone and the big screen both render this one text. */
export function NumberMarginText({
  margin = DEFAULT_MARGIN,
  className,
}: {
  margin?: Margin;
  className?: string;
}) {
  return <p className={className}>{formatMarginText(margin)}</p>;
}
