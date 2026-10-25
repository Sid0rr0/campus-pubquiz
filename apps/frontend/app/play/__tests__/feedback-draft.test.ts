import { describe, expect, it } from 'vitest';
import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  MAX_FEEDBACK_TOPICS,
  MAX_FEEDBACK_TOPIC_LENGTH,
} from '@campus-pubquiz/types';
import { cleanTopics, findDraftProblems } from '@/app/play/feedback-draft';

describe('cleanTopics', () => {
  it('trims lines and drops empty and whitespace-only ones', () => {
    expect(cleanTopics(['  rock ', '', '   ', 'film'])).toEqual([
      'rock',
      'film',
    ]);
  });
});

describe('findDraftProblems', () => {
  it('accepts a comment of exactly the limit and flags one character more', () => {
    expect(
      findDraftProblems({
        comment: 'a'.repeat(MAX_FEEDBACK_COMMENT_LENGTH),
        topics: [],
      }),
    ).toEqual([]);
    expect(
      findDraftProblems({
        comment: 'a'.repeat(MAX_FEEDBACK_COMMENT_LENGTH + 1),
        topics: [],
      }),
    ).toEqual([
      `Your comment is ${MAX_FEEDBACK_COMMENT_LENGTH + 1} characters — the limit is ${MAX_FEEDBACK_COMMENT_LENGTH} characters.`,
    ]);
  });

  it('measures a topic after trimming, accepting exactly the limit', () => {
    const atLimit = 'a'.repeat(MAX_FEEDBACK_TOPIC_LENGTH);
    expect(
      findDraftProblems({ comment: '', topics: [`  ${atLimit}  `] }),
    ).toEqual([]);
    expect(findDraftProblems({ comment: '', topics: [atLimit] })).toEqual([]);
  });

  it('names the topic line that is one character too long', () => {
    expect(
      findDraftProblems({
        comment: '',
        topics: ['ok', 'a'.repeat(MAX_FEEDBACK_TOPIC_LENGTH + 1)],
      }),
    ).toEqual([
      `Topic 2 is too long — the limit is ${MAX_FEEDBACK_TOPIC_LENGTH} characters.`,
    ]);
  });

  it('accepts the topic limit and flags one more, ignoring blank lines', () => {
    const topics = Array.from(
      { length: MAX_FEEDBACK_TOPICS },
      (_, i) => `t${i}`,
    );
    expect(findDraftProblems({ comment: '', topics })).toEqual([]);
    expect(
      findDraftProblems({ comment: '', topics: [...topics, '', '  '] }),
    ).toEqual([]);
    expect(
      findDraftProblems({ comment: '', topics: [...topics, 'one more'] }),
    ).toEqual([`Suggest up to ${MAX_FEEDBACK_TOPICS} topics.`]);
  });
});
