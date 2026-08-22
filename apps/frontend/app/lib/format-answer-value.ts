import {
  IDK_ANSWER_VALUE,
  splitPipeList,
  type QuestionType,
} from '@campus-pubquiz/types';

/**
 * sort/match answers are stored/submitted as a `|`-joined string.
 *
 * - sort: formatted as a single arrow chain (the value *is* the order).
 * - match: each right-hand value is positionally aligned to `leftItems`
 *   (the question's `options`) — without them a bare arrow chain of the
 *   right side loses which left item it was paired with, so pass
 *   `leftItems` whenever they're available to render "left → right" pairs
 *   instead. Falls back to a bare chain if `leftItems` is missing or its
 *   length doesn't match (defensive — the two should always agree).
 */
export function formatAnswerValue(
  value: string,
  type: QuestionType,
  leftItems?: string[],
): string {
  if (value === IDK_ANSWER_VALUE) return "🤷 I don't know";
  if (type === 'sort') return splitPipeList(value).join(' → ');
  if (type === 'match') {
    const rightItems = splitPipeList(value);
    if (leftItems && leftItems.length === rightItems.length) {
      return leftItems
        .map((left, index) => `${left} → ${rightItems[index]}`)
        .join(', ');
    }
    return rightItems.join(' → ');
  }
  return value;
}
