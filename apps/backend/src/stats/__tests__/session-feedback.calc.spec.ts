import {
  computeSessionFeedback,
  groupTopics,
} from '@/stats/session-feedback.calc';

describe('groupTopics', () => {
  it('groups topics regardless of capitals and spacing, most-mentioned first', () => {
    expect(
      groupTopics([['Quiz  Music', 'food'], [' quiz music '], ['QUIZ MUSIC']]),
    ).toEqual([
      { topic: 'Quiz Music', count: 3 },
      { topic: 'food', count: 1 },
    ]);
  });

  it('shows the most common spelling, the earliest submitted on a tie', () => {
    expect(groupTopics([['Music'], ['music'], ['music']])).toEqual([
      { topic: 'music', count: 3 },
    ]);
    expect(groupTopics([['Music'], ['music']])).toEqual([
      { topic: 'Music', count: 2 },
    ]);
  });

  it('keeps topics that differ in their spaces apart', () => {
    expect(groupTopics([['a b'], ['ab'], ['a b']])).toEqual([
      { topic: 'a b', count: 2 },
      { topic: 'ab', count: 1 },
    ]);
  });

  it('skips blank topics', () => {
    expect(groupTopics([['', '   ', 'a']])).toEqual([{ topic: 'a', count: 1 }]);
  });

  it('lists topics with the same count alphabetically', () => {
    expect(groupTopics([['b', 'c', 'a']])).toEqual([
      { topic: 'a', count: 1 },
      { topic: 'b', count: 1 },
      { topic: 'c', count: 1 },
    ]);
  });

  it('is empty without submissions', () => {
    expect(groupTopics([])).toEqual([]);
  });
});

describe('computeSessionFeedback', () => {
  it('reports feedback as not collected, with nothing listed', () => {
    expect(
      computeSessionFeedback(false, [
        { comment: 'hi', topics: ['a'], submittedAt: '2026-10-01T19:00:00Z' },
      ]),
    ).toEqual({ collected: false, comments: [], topics: [] });
  });

  it('lists comments newest first, skipping blank ones, with ISO timestamps', () => {
    const feedback = computeSessionFeedback(true, [
      { comment: 'first', topics: [], submittedAt: '2026-10-01T19:00:00Z' },
      { comment: '   ', topics: [], submittedAt: '2026-10-01T19:30:00Z' },
      {
        comment: 'second',
        topics: [],
        submittedAt: new Date('2026-10-01T20:00:00Z'),
      },
    ]);

    expect(feedback.collected).toBe(true);
    expect(feedback.comments).toEqual([
      { text: 'second', submittedAt: '2026-10-01T20:00:00.000Z' },
      { text: 'first', submittedAt: '2026-10-01T19:00:00.000Z' },
    ]);
  });

  it('groups the topics of every row', () => {
    const feedback = computeSessionFeedback(true, [
      { comment: '', topics: ['Music'], submittedAt: '2026-10-01T19:00:00Z' },
      { comment: '', topics: ['music'], submittedAt: '2026-10-01T19:01:00Z' },
    ]);

    expect(feedback.topics).toEqual([{ topic: 'Music', count: 2 }]);
  });
});
