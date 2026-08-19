import { splitPipeList, type QuestionType } from '@campus-pubquiz/types';

/** sort/match answers are stored/submitted as a `|`-joined string — format it as an arrow chain for display instead of showing the raw pipe delimiters. */
export function formatAnswerValue(value: string, type: QuestionType): string {
  return type === 'sort' || type === 'match'
    ? splitPipeList(value).join(' → ')
    : value;
}
