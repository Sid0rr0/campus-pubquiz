import { rankTeams } from '@campus-pubquiz/types';
import type { SessionStandings } from '@/standings/standings.service';
import { computeSessionDetail } from '@/stats/session-detail.calc';
import {
  briefMediaKind,
  computeSessionBrief,
  type SessionBriefInput,
} from '@/stats/session-brief.calc';

interface TestTeam {
  teamId: number;
  teamName: string;
  hasLeft?: boolean;
}

function standingsFor(
  teams: TestTeam[],
  answers: SessionBriefInput['answers'],
): SessionStandings {
  const entries = teams.map((team) => ({
    hasLeft: team.hasLeft === true,
    entry: {
      teamId: team.teamId,
      teamName: team.teamName,
      totalPoints: answers
        .filter((a) => a.teamId === team.teamId)
        .reduce((sum, a) => sum + a.pointsAwarded, 0),
      bonusPoints: 0,
      positiveBonusPoints: 0,
      negativeBonusPoints: 0,
      roundPoints: [],
    },
  }));
  const leaderboard = rankTeams(
    entries.filter((e) => !e.hasLeft).map((e) => e.entry),
  );
  return {
    leaderboard,
    departed: entries.filter((e) => e.hasLeft).map((e) => e.entry),
    participantCount: entries.length,
    winner: leaderboard[0],
  };
}

const TEAMS: TestTeam[] = [
  { teamId: 1, teamName: 'Zebra Crossing' },
  { teamId: 2, teamName: 'Quizzy Rascals' },
  { teamId: 3, teamName: 'Gone Fishing', hasLeft: true },
];

function answer(
  questionId: number,
  teamId: number,
  verdict: 'correct' | 'partial' | 'incorrect' | null,
  pointsAwarded: number,
) {
  return {
    questionId,
    teamId,
    teamName: TEAMS.find((t) => t.teamId === teamId)!.teamName,
    pointsAwarded,
    gradedAt: verdict === null ? null : '2026-03-05T20:00:00.000Z',
    verdict,
    responseMs: 1200,
    answer: `Guess of team ${teamId}`,
  };
}

function buildInput(
  overrides: Partial<SessionBriefInput> = {},
): SessionBriefInput {
  const answers = overrides.answers ?? [
    answer(10, 1, 'correct', 2),
    answer(10, 2, 'incorrect', 0),
    answer(10, 3, 'correct', 2),
    answer(11, 1, 'partial', 1),
    answer(12, 1, 'correct', 3),
  ];
  return {
    session: {
      gameSessionId: 7,
      joinCode: 'ABCDEF',
      quizTitle: 'Spring Quiz',
      name: 'Spring Quiz Week 3',
      playedAt: '2026-03-05T19:00:00.000Z',
    },
    standings: standingsFor(TEAMS, answers),
    playerCounts: new Map(),
    rounds: [
      {
        roundId: 100,
        title: 'Geography',
        category: 'Places',
        orderIndex: 0,
        author: 'Alex',
        note: 'Warm-up round',
        isKahoot: false,
      },
      {
        roundId: 101,
        title: 'Speed Round',
        category: null,
        orderIndex: 1,
        author: null,
        note: null,
        isKahoot: true,
      },
    ],
    roundRatings: [],
    isFeedbackCollected: true,
    feedback: [],
    questions: [
      {
        questionId: 10,
        roundId: 100,
        orderIndex: 0,
        prompt: 'Capital of France?',
        type: 'free_text',
        answer: 'Paris',
        points: 2,
        notes: 'Easy opener {margin: "5%"}',
        media: { question: 'image' },
      },
      {
        questionId: 11,
        roundId: 100,
        orderIndex: 1,
        prompt: 'Guess the height of Everest',
        type: 'closest_guess',
        answer: '8849',
        points: 2,
        notes: null,
        media: { answer: 'video' },
      },
      {
        questionId: 12,
        roundId: 101,
        orderIndex: 0,
        prompt: 'Name a primary colour',
        type: 'free_text',
        answer: 'Red',
        points: 3,
        notes: '   ',
        media: {},
      },
    ],
    answers,
    bonusAwards: [],
    openedQuestionIds: [10, 11, 12],
    ...overrides,
  };
}

/** A fixture answer with a chosen text, for the wrong-answer cases. */
function said(
  questionId: number,
  teamId: number,
  verdict: 'correct' | 'partial' | 'incorrect' | null,
  text: string,
) {
  return {
    questionId,
    teamId,
    teamName: `Team ${teamId}`,
    pointsAwarded: 0,
    gradedAt: verdict === null ? null : '2026-03-05T20:00:00.000Z',
    verdict,
    responseMs: 1200,
    answer: text,
  };
}

/** A brief for one question of the given type, with answers from numbered teams. */
function briefOfQuestion(
  question: Partial<SessionBriefInput['questions'][number]>,
  answers: SessionBriefInput['answers'],
  extra: Partial<SessionBriefInput> = {},
): string {
  const teams = Array.from({ length: 12 }, (_, i) => ({
    teamId: i + 1,
    teamName: `Team ${i + 1}`,
  }));
  const input = buildInput({
    standings: standingsFor(teams, answers),
    rounds: [
      {
        roundId: 100,
        title: 'Only Round',
        category: null,
        orderIndex: 0,
        author: null,
        note: null,
        isKahoot: false,
      },
    ],
    questions: [
      {
        questionId: 50,
        roundId: 100,
        orderIndex: 0,
        prompt: 'The prompt',
        type: 'free_text',
        answer: 'Paris',
        points: 2,
        notes: null,
        media: {},
        ...question,
      },
    ],
    answers,
    openedQuestionIds: [50],
    ...extra,
  });
  return computeSessionBrief(input);
}

describe('computeSessionBrief wrong answers', () => {
  it('lists the top 3 incorrect free_text answers grouped across spellings, ties alphabetical, partials left out', () => {
    const brief = briefOfQuestion({ type: 'free_text' }, [
      said(50, 1, 'incorrect', 'London'),
      said(50, 2, 'incorrect', ' london '),
      said(50, 3, 'incorrect', 'LONDON'),
      said(50, 4, 'incorrect', 'Berlin'),
      said(50, 5, 'incorrect', 'berlin'),
      said(50, 6, 'incorrect', 'Rome'),
      said(50, 7, 'incorrect', 'Madrid'),
      said(50, 8, 'incorrect', 'Athens'),
      said(50, 9, 'partial', 'Pariss'),
      said(50, 10, 'correct', 'Paris'),
    ]);

    expect(brief).toContain(
      '- Wrong answers: London (3), Berlin (2), Athens (1)',
    );
    expect(brief).not.toContain('Pariss');
    expect(brief).not.toContain('Madrid');
  });

  it('shows the most common spelling of a group', () => {
    const brief = briefOfQuestion({ type: 'free_text' }, [
      said(50, 1, 'incorrect', 'lisbon'),
      said(50, 2, 'incorrect', 'Lisbon'),
      said(50, 3, 'incorrect', 'Lisbon'),
    ]);

    expect(brief).toContain('- Wrong answers: Lisbon (3)');
  });

  it('groups number answers the same way', () => {
    const brief = briefOfQuestion({ type: 'number', answer: '42' }, [
      said(50, 1, 'incorrect', '41'),
      said(50, 2, 'incorrect', '41'),
      said(50, 3, 'incorrect', '7'),
    ]);

    expect(brief).toContain('- Wrong answers: 41 (2), 7 (1)');
  });

  it('writes no wrong-answers line when nobody was wrong', () => {
    const brief = briefOfQuestion({ type: 'free_text' }, [
      said(50, 1, 'correct', 'Paris'),
    ]);

    expect(brief).not.toContain('Wrong answers');
  });

  it('lists every multiple_choice option in stored order with its pick count and the correct one marked', () => {
    const brief = briefOfQuestion(
      {
        type: 'multiple_choice',
        answer: 'Paris',
        options: ['Rome', 'Paris', 'Oslo'],
      },
      [
        said(50, 1, 'correct', 'Paris'),
        said(50, 2, 'incorrect', 'Rome'),
        said(50, 3, 'incorrect', 'Rome'),
      ],
    );

    expect(brief).toContain(
      '- Options: Rome (2), Paris (1) [correct], Oslo (0)',
    );
    expect(brief).not.toContain('Wrong answers');
  });

  it('shows the lowest, median and highest closest_guess guess', () => {
    const brief = briefOfQuestion({ type: 'closest_guess', answer: '100' }, [
      said(50, 1, 'incorrect', '10'),
      said(50, 2, 'incorrect', '30'),
      said(50, 3, 'incorrect', '250'),
      said(50, 4, 'incorrect', '60'),
    ]);

    expect(brief).toContain('- Guesses: lowest 10, median 45, highest 250');
  });

  it('adds nothing for sort and match questions', () => {
    for (const type of ['sort', 'match'] as const) {
      const brief = briefOfQuestion({ type, answer: 'a|b' }, [
        said(50, 1, 'incorrect', 'b → a'),
        said(50, 2, null, 'x'),
      ]);

      expect(brief).not.toContain('Wrong answers');
      expect(brief).not.toContain('Ungraded');
      expect(brief).not.toContain('b → a');
    }
  });

  it('lists ungraded answers on their own line, never among the wrong answers', () => {
    const brief = briefOfQuestion({ type: 'free_text' }, [
      said(50, 1, 'incorrect', 'London'),
      said(50, 2, null, 'Parris'),
      said(50, 3, null, 'parris'),
      said(50, 4, null, 'Pari'),
    ]);

    expect(brief).toContain('- Wrong answers: London (1)');
    expect(brief).toContain('- Ungraded answers: Parris (2), Pari (1)');
    expect(brief.split('- Wrong answers')[1].split('\n')[0]).not.toContain(
      'Parris',
    );
  });
});

describe('computeSessionBrief answer wording', () => {
  it('words a sort key as an arrow chain and a match key as pairs', () => {
    expect(
      briefOfQuestion({ type: 'sort', answer: 'Ant|Bee|Cat' }, []),
    ).toContain('- Answer: Ant → Bee → Cat');
    expect(
      briefOfQuestion(
        { type: 'match', answer: 'Paris|Rome', options: ['France', 'Italy'] },
        [],
      ),
    ).toContain('- Answer: France → Paris, Italy → Rome');
  });

  it('words a team\'s "I don\'t know" like the stats page does', () => {
    const brief = briefOfQuestion({ type: 'free_text' }, [
      said(50, 1, 'incorrect', '__idk__'),
    ]);

    expect(brief).toContain("- Wrong answers: 🤷 I don't know (1)");
  });
});

describe('computeSessionBrief unplayed questions', () => {
  it('marks a question the session never reached "not played" and one reached with no answers "0 answered"', () => {
    const brief = computeSessionBrief(
      buildInput({
        answers: [answer(10, 1, 'correct', 2)],
        openedQuestionIds: [10, 11],
      }),
    );

    const [, , reachedUnanswered, unreached] = brief.split(/^### /m);
    expect(reachedUnanswered).toContain('Answered 0');
    expect(reachedUnanswered).not.toContain('not played');
    expect(unreached).toContain('not played');
    expect(unreached).not.toMatch(/Answered|correct rate/);
  });

  it('for a session that never tracked opened questions, calls every question after the last answered one "not played"', () => {
    const brief = computeSessionBrief(
      buildInput({
        answers: [answer(10, 1, 'correct', 2)],
        openedQuestionIds: null,
      }),
    );
    const gap = computeSessionBrief(
      buildInput({
        answers: [answer(10, 1, 'correct', 2), answer(12, 1, 'correct', 3)],
        openedQuestionIds: null,
      }),
    );

    const [, , second, third] = brief.split(/^### /m);
    expect(second).toContain('not played');
    expect(third).toContain('not played');
    expect(gap.split(/^### /m)[2]).toContain('Answered 0');
  });

  it('treats a question with answers as played even when not listed as reached', () => {
    const brief = computeSessionBrief(buildInput({ openedQuestionIds: [] }));

    expect(brief).not.toContain('not played');
  });
});

describe('computeSessionBrief', () => {
  it('opens with the session name, date and team count, departed teams included', () => {
    const brief = computeSessionBrief(buildInput());

    expect(brief).toContain('# Spring Quiz Week 3');
    expect(brief).toContain('Date: 2026-03-05');
    expect(brief).toContain('Teams: 3');
  });

  it("dates the session in the viewer's time zone, UTC by default", () => {
    const late = {
      ...buildInput().session,
      playedAt: '2026-03-05T23:30:00.000Z',
    };

    expect(computeSessionBrief(buildInput({ session: late }))).toContain(
      'Date: 2026-03-05',
    );
    expect(
      computeSessionBrief(
        buildInput({ session: late, timeZone: 'Asia/Tokyo' }),
      ),
    ).toContain('Date: 2026-03-06');
  });

  it('writes each round with category, author, note and kahoot flag, leaving out the author line when there is none', () => {
    const brief = computeSessionBrief(buildInput());

    const [, geography, speed] = brief.split(/^## (?=Round )/m);
    expect(geography).toContain('Round 1: Geography');
    expect(geography).toContain('Category: Places');
    expect(geography).toContain('Author: Alex');
    expect(geography).toContain('Note: Warm-up round');
    expect(geography).not.toMatch(/kahoot/i);
    expect(speed).toContain('Round 2: Speed Round');
    expect(speed).toContain('Kahoot round\n');
    expect(speed).not.toMatch(/scale|speed:/i);
    expect(speed).not.toContain('Author');
  });

  it('writes each question with answer, points, notes without the settings group, media flag and counts', () => {
    const brief = computeSessionBrief(buildInput());

    const [, first, second, third] = brief.split(/^### /m);
    expect(first).toContain('Q1');
    expect(first).toContain('free_text');
    expect(first).toContain('Capital of France?');
    expect(first).toContain('Answer: Paris');
    expect(first).toContain('2 pts');
    expect(first).toContain('Notes: Easy opener');
    expect(first).not.toContain('margin');
    expect(first).toContain('Media: image');
    // 3 teams took part (one has since left); 2 of 3 answered correctly... 2 correct, 1 incorrect.
    expect(first).toContain('Answered 3');
    expect(first).toContain('correct 2');
    expect(first).toContain('partial 0');
    expect(first).toContain('correct rate 67%');
    expect(second).toContain('Answer media: video');
    expect(second).toContain('partial 1');
    expect(third).toContain('Q1');
    expect(third).not.toContain('Notes:');
    expect(third).not.toContain('Media');
  });

  it('shows no correct rate for a closest_guess question', () => {
    const brief = computeSessionBrief(buildInput());

    const second = brief.split(/^### /m)[2].split(/^## /m)[0];
    expect(second).toContain('closest_guess');
    expect(second).not.toMatch(/correct rate/i);
  });

  it('never prints a team name, code or id, nor a media url', () => {
    const brief = computeSessionBrief(buildInput());

    for (const leaked of [
      'Zebra Crossing',
      'Quizzy Rascals',
      'Gone Fishing',
      'ABCDEF',
    ]) {
      expect(brief).not.toContain(leaked);
    }
  });

  describe('standings, ratings and feedback', () => {
    function section(brief: string, heading: string): string {
      return (
        brief.split(/^## /m).find((s) => s.startsWith(`${heading}\n`)) ?? ''
      );
    }

    it('gives player totals and the score spread as shares of max points', () => {
      const brief = computeSessionBrief(
        buildInput({
          playerCounts: new Map([
            [1, 4],
            [2, 3],
          ]),
        }),
      );

      // 2 of 3 teams reported: 4 + 3 players. Max points 7; totals 6, 0, 2.
      expect(brief).toContain('Players: 7 (2 of 3 teams reported)');
      expect(brief).toContain('Score spread: top 86%, median 29%, bottom 0%');
    });

    it('lists standings with placing, points, share and players, departed teams as left', () => {
      const brief = computeSessionBrief(
        buildInput({ playerCounts: new Map([[1, 4]]) }),
      );

      const standings = section(brief, 'Standings');
      expect(standings).toContain('- 1st: 6 pts (86%), 4 players');
      expect(standings).toContain('- 2nd: 0 pts (0%)');
      expect(standings).toContain('- left: 2 pts (29%)');
      expect(standings.indexOf('1st')).toBeLessThan(standings.indexOf('2nd'));
    });

    it('counts bonus awards in the points without itemising them', () => {
      const answers = [
        answer(10, 1, 'correct', 2),
        answer(10, 2, 'correct', 2),
      ];
      const input = buildInput({ answers });
      input.standings.leaderboard[0].totalPoints += 1;
      input.standings.leaderboard[0].bonusPoints = 1;
      input.standings.leaderboard[0].positiveBonusPoints = 1;
      input.standings.leaderboard = rankTeams([...input.standings.leaderboard]);
      const brief = computeSessionBrief(input);
      const detail = computeSessionDetail(input);

      expect(detail.standings[0].total).toBe(3);
      expect(section(brief, 'Standings')).toContain('- 1st: 3 pts');
      expect(section(brief, 'Standings')).toContain('- 2nd: 2 pts');
    });

    it('writes Joint for a shared placing', () => {
      const answers = [
        answer(10, 1, 'correct', 2),
        answer(10, 2, 'correct', 2),
      ];
      const brief = computeSessionBrief(buildInput({ answers }));

      expect(section(brief, 'Standings')).toContain('- Joint 1st: 2 pts');
    });

    it('names the hardest and easiest question', () => {
      const brief = computeSessionBrief(buildInput());

      const highlights = section(brief, 'Highlights');
      // Q1 round 1 is 67%, Q1 round 2 is 33%.
      expect(highlights).toContain(
        'Hardest question: Round 2 Q1 "Name a primary colour" (33% correct)',
      );
      expect(highlights).toContain(
        'Easiest question: Round 1 Q1 "Capital of France?" (67% correct)',
      );
      expect(highlights).not.toContain('Everest');
    });

    it('gives each round its star rating and correct rate', () => {
      const brief = computeSessionBrief(
        buildInput({
          roundRatings: [{ roundId: 100, average: 4.25, count: 3 }],
        }),
      );

      const [, geography, speed] = brief.split(/^## Round /m);
      expect(geography).toContain('Rating: 4.3 stars (3 ratings)');
      // Q1 67% only; the closest_guess question has no rate.
      expect(geography).toContain('Correct rate: 67%');
      expect(speed).toContain('Rating: no ratings');
    });

    it('gives a round of only closest_guess questions no correct rate', () => {
      const input = buildInput();
      input.questions[0].type = 'closest_guess';
      const brief = computeSessionBrief(input);

      const geography = brief.split(/^## Round /m)[1];
      expect(geography).not.toContain('Correct rate');
    });

    it('writes topics with counts and comments newest first, skipping blanks', () => {
      const brief = computeSessionBrief(
        buildInput({
          feedback: [
            {
              comment: 'Too hard',
              topics: ['Films', 'music'],
              submittedAt: '2026-03-05T21:00:00.000Z',
            },
            {
              comment: '   ',
              topics: ['films'],
              submittedAt: '2026-03-05T21:05:00.000Z',
            },
            {
              comment: 'Loved it',
              topics: [],
              submittedAt: '2026-03-05T21:10:00.000Z',
            },
          ],
        }),
      );

      const feedback = section(brief, 'Feedback');
      expect(feedback).toContain('- Films: 2');
      expect(feedback).toContain('- music: 1');
      expect(feedback.indexOf('Loved it')).toBeGreaterThan(-1);
      expect(feedback.indexOf('Loved it')).toBeLessThan(
        feedback.indexOf('Too hard'),
      );
      expect(feedback.match(/- "/g)).toHaveLength(2);
    });

    it('says feedback was off instead of listing it', () => {
      const brief = computeSessionBrief(
        buildInput({ isFeedbackCollected: false }),
      );

      expect(section(brief, 'Feedback')).toContain('Feedback was off');
    });

    it('writes no fixture team name anywhere', () => {
      const brief = computeSessionBrief(
        buildInput({ playerCounts: new Map([[1, 4]]) }),
      );

      for (const name of TEAMS.map((t) => t.teamName)) {
        expect(brief).not.toContain(name);
      }
    });
  });

  it('agrees with computeSessionDetail on counts and rates for the same rows', () => {
    const input = buildInput();
    const detail = computeSessionDetail(input);
    const brief = computeSessionBrief(input);

    expect(detail.teamCount).toBe(3);
    for (const row of detail.questions) {
      const block = brief
        .split(/^### /m)
        .find((b) => b.split('\n')[1] === row.prompt)!;
      expect(block).toContain(`Answered ${row.answeredCount}`);
      expect(block).toContain(`correct ${row.correctCount}`);
      if (row.correctRate !== null) {
        expect(block).toContain(
          `correct rate ${Math.round(row.correctRate * 100)}%`,
        );
      }
    }
  });
});

describe('briefMediaKind', () => {
  it('says video for YouTube links and video files, and keeps image and audio', () => {
    expect(briefMediaKind(undefined)).toBeUndefined();
    expect(briefMediaKind('youtube')).toBe('video');
    expect(briefMediaKind('video-file')).toBe('video');
    expect(briefMediaKind('image')).toBe('image');
    expect(briefMediaKind('audio')).toBe('audio');
  });
});

describe('computeSessionBrief layout', () => {
  const EMPTY_STANDINGS: SessionStandings = {
    leaderboard: [],
    departed: [],
    participantCount: 0,
    winner: undefined,
  };

  /** A standings entry with no points, placed as given. */
  const placed = (teamId: number, rank: number, rankTo = rank) => ({
    teamId,
    teamName: `Team ${teamId}`,
    totalPoints: 0,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
    rank,
    rankTo,
  });

  const linesOf = (input: SessionBriefInput) =>
    computeSessionBrief(input).split('\n');

  const round = (
    roundId: number,
    orderIndex: number,
    overrides: Partial<SessionBriefInput['rounds'][number]> = {},
  ) => ({
    roundId,
    title: `Round ${roundId}`,
    category: null,
    orderIndex,
    author: null,
    note: null,
    isKahoot: false,
    ...overrides,
  });

  const question = (
    questionId: number,
    roundId: number,
    orderIndex: number,
    overrides: Partial<SessionBriefInput['questions'][number]> = {},
  ): SessionBriefInput['questions'][number] => ({
    questionId,
    roundId,
    orderIndex,
    prompt: `Prompt ${questionId}`,
    type: 'free_text',
    answer: 'A',
    points: 2,
    notes: null,
    media: {},
    ...overrides,
  });

  /** The brief's lines from the blank line before the first question up to the feedback section. */
  const questionBlock = (brief: string) => {
    const lines = brief.split('\n');
    const start = lines.findIndex((l) => l.startsWith('### Q1'));
    return lines.slice(start - 1, lines.indexOf('## Feedback') - 1);
  };

  it('writes an empty session as its header, an empty standings section and the feedback note', () => {
    const brief = computeSessionBrief(
      buildInput({
        standings: EMPTY_STANDINGS,
        rounds: [],
        questions: [],
        answers: [],
        openedQuestionIds: [],
        isFeedbackCollected: false,
      }),
    );

    expect(brief).toBe(
      [
        '# Spring Quiz Week 3',
        '',
        'Date: 2026-03-05',
        'Teams: 0',
        'Players: 0 (0 of 0 teams reported)',
        '',
        '## Standings',
        '',
        '## Feedback',
        'Feedback was off.',
        '',
      ].join('\n'),
    );
  });

  it('writes collected feedback with nothing in it as none', () => {
    const lines = linesOf(
      buildInput({
        standings: EMPTY_STANDINGS,
        rounds: [],
        questions: [],
        answers: [],
        openedQuestionIds: [],
      }),
    );

    expect(lines.slice(lines.indexOf('## Feedback') - 1)).toEqual([
      '',
      '## Feedback',
      '',
      'Topic suggestions:',
      '- none',
      '',
      'Comments (newest first):',
      '- none',
      '',
    ]);
  });

  it('writes topics with counts and trimmed comments', () => {
    const lines = linesOf(
      buildInput({
        standings: EMPTY_STANDINGS,
        rounds: [],
        questions: [],
        answers: [],
        openedQuestionIds: [],
        feedback: [
          {
            comment: '  lovely night  ',
            topics: ['Music'],
            submittedAt: '2026-03-05T21:00:00.000Z',
          },
          {
            comment: '',
            topics: ['music'],
            submittedAt: '2026-03-05T21:01:00.000Z',
          },
        ],
      }),
    );

    expect(lines.slice(lines.indexOf('## Feedback') - 1)).toEqual([
      '',
      '## Feedback',
      '',
      'Topic suggestions:',
      '- Music: 2',
      '',
      'Comments (newest first):',
      '- "lovely night"',
      '',
    ]);
  });

  describe('session rating, pacing and felt difficulty lines', () => {
    const at = '2026-03-05T21:00:00.000Z';
    const row = (
      pacing: 'too_slow' | 'just_right' | 'too_fast' | null,
      feltDifficulty: 'too_easy' | 'just_right' | 'too_hard' | null,
    ) => ({ comment: '', topics: [], submittedAt: at, pacing, feltDifficulty });

    it('writes the session rating and both count lines in scale order', () => {
      const lines = linesOf(
        buildInput({
          roundRatings: [
            { roundId: 100, average: 4, count: 2 },
            { roundId: 101, average: 5, count: 1 },
          ],
          feedback: [
            row('too_fast', 'too_hard'),
            row('just_right', null),
            row('just_right', 'too_hard'),
            row(null, null),
          ],
        }),
      );

      expect(lines).toContain('Session rating: 4.3 stars (3 ratings)');
      expect(lines).toContain('Pacing: too slow 0, just right 2, too fast 1');
      expect(lines).toContain(
        'Felt difficulty: too easy 0, just right 0, too hard 2',
      );
    });

    it('says no ratings and no answers when nobody gave any', () => {
      const lines = linesOf(buildInput({ feedback: [row(null, null)] }));

      expect(lines).toContain('Session rating: no ratings');
      expect(lines).toContain('Pacing: no answers');
      expect(lines).toContain('Felt difficulty: no answers');
    });

    it('leaves the lines out when feedback was off', () => {
      const brief = computeSessionBrief(
        buildInput({
          isFeedbackCollected: false,
          roundRatings: [{ roundId: 100, average: 4, count: 2 }],
          feedback: [row('too_fast', 'too_hard')],
        }),
      );

      expect(brief).not.toContain('Session rating');
      expect(brief).not.toContain('Pacing');
      expect(brief).not.toContain('Felt difficulty');
      expect(brief).toContain('Feedback was off.');
    });
  });

  it('words placings with the right suffix, joint places, departed teams and player counts', () => {
    const ranks = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112, 113];
    const leaderboard = [
      ...ranks.map((rank, i) => placed(i + 1, rank)),
      placed(20, 120, 121),
    ];
    const departed = [
      {
        teamId: 30,
        teamName: 'Gone',
        totalPoints: 0,
        bonusPoints: 0,
        positiveBonusPoints: 0,
        negativeBonusPoints: 0,
        roundPoints: [],
      },
    ];
    const lines = linesOf(
      buildInput({
        standings: {
          leaderboard,
          departed,
          participantCount: leaderboard.length + 1,
          winner: leaderboard[0],
        },
        // Team 1 has one player, team 2 two, the rest none reported.
        playerCounts: new Map([
          [1, 1],
          [2, 2],
        ]),
        rounds: [],
        questions: [],
        answers: [],
        openedQuestionIds: [],
      }),
    );

    const start = lines.indexOf('## Standings');
    expect(lines.slice(start + 1, start + 18)).toEqual([
      '- 1st: 0 pts (0%), 1 player',
      '- 2nd: 0 pts (0%), 2 players',
      '- 3rd: 0 pts (0%)',
      '- 4th: 0 pts (0%)',
      '- 11th: 0 pts (0%)',
      '- 12th: 0 pts (0%)',
      '- 13th: 0 pts (0%)',
      '- 21st: 0 pts (0%)',
      '- 22nd: 0 pts (0%)',
      '- 23rd: 0 pts (0%)',
      '- 101st: 0 pts (0%)',
      '- 111th: 0 pts (0%)',
      '- 112th: 0 pts (0%)',
      '- 113th: 0 pts (0%)',
      '- Joint 120th: 0 pts (0%)',
      '- left: 0 pts (0%)',
      '',
    ]);
    // With no points to win the spread is zero, not a division by zero.
    expect(lines).toContain('Score spread: top 0%, median 0%, bottom 0%');
  });

  it('numbers the rounds and questions by order index, whatever order the rows come in', () => {
    const lines = linesOf(
      buildInput({
        standings: standingsFor(TEAMS, []),
        rounds: [round(200, 1), round(100, 0)],
        questions: [
          question(23, 200, 3),
          question(22, 200, 2),
          question(21, 200, 1),
          question(13, 100, 3),
          question(12, 100, 2),
          question(11, 100, 1),
        ],
        answers: [],
        openedQuestionIds: [11, 12, 13, 21, 22, 23],
      }),
    );

    expect(
      lines.filter((l) => l.startsWith('## Round') || l.startsWith('### Q')),
    ).toEqual([
      '## Round 1: Round 100',
      '### Q1 (free_text, 2 pts)',
      '### Q2 (free_text, 2 pts)',
      '### Q3 (free_text, 2 pts)',
      '## Round 2: Round 200',
      '### Q1 (free_text, 2 pts)',
      '### Q2 (free_text, 2 pts)',
      '### Q3 (free_text, 2 pts)',
    ]);
    expect(lines.filter((l) => l.startsWith('Prompt'))).toEqual([
      'Prompt 11',
      'Prompt 12',
      'Prompt 13',
      'Prompt 21',
      'Prompt 22',
      'Prompt 23',
    ]);
  });

  it('names the hardest and easiest question by their round and question number', () => {
    const team = (teamId: number) => ({
      teamId,
      teamName: `Team ${teamId}`,
    });
    const right = (questionId: number, teamId: number) => ({
      ...said(questionId, teamId, 'correct', 'a'),
      pointsAwarded: 2,
    });
    const wrong = (questionId: number, teamId: number) =>
      said(questionId, teamId, 'incorrect', 'b');
    const answers = [
      // Prompt 11: half right. Prompt 12: nobody. Prompt 21: everybody.
      right(11, 1),
      wrong(11, 2),
      wrong(12, 1),
      wrong(12, 2),
      right(21, 1),
      right(21, 2),
    ];
    const lines = linesOf(
      buildInput({
        standings: standingsFor([team(1), team(2)], answers),
        rounds: [round(200, 1), round(100, 0)],
        questions: [
          question(21, 200, 0),
          question(12, 100, 1),
          question(11, 100, 0),
        ],
        answers,
        openedQuestionIds: [11, 12, 21],
      }),
    );

    const start = lines.indexOf('## Highlights');
    expect(lines.slice(start - 1, start + 3)).toEqual([
      '',
      '## Highlights',
      '- Hardest question: Round 1 Q2 "Prompt 12" (0% correct)',
      '- Easiest question: Round 2 Q1 "Prompt 21" (100% correct)',
    ]);
  });

  it('writes no highlights when no question has a correct rate', () => {
    const lines = linesOf(buildInput({ questions: [], openedQuestionIds: [] }));

    expect(lines).not.toContain('## Highlights');
  });

  it('writes a round with its category, author, kahoot flag and note, and one without', () => {
    const lines = linesOf(
      buildInput({
        standings: standingsFor(TEAMS, []),
        rounds: [
          round(100, 0, {
            title: 'Full',
            category: 'Places',
            author: 'Alex',
            isKahoot: true,
            note: 'Warm-up',
          }),
          round(101, 1, { title: 'Bare' }),
        ],
        questions: [],
        answers: [],
        openedQuestionIds: [],
      }),
    );

    const start = lines.indexOf('## Round 1: Full');
    expect(lines.slice(start - 1, lines.indexOf('## Feedback') - 1)).toEqual([
      '',
      '## Round 1: Full',
      'Category: Places',
      'Author: Alex',
      'Kahoot round',
      'Note: Warm-up',
      'Rating: no ratings',
      '',
      '## Round 2: Bare',
      'Rating: no ratings',
    ]);
  });

  it('writes a round rating and its correct rate', () => {
    const answers = [
      { ...said(11, 1, 'correct', 'a'), pointsAwarded: 2 },
      said(11, 2, 'incorrect', 'b'),
    ];
    const lines = linesOf(
      buildInput({
        standings: standingsFor(
          [
            { teamId: 1, teamName: 'Team 1' },
            { teamId: 2, teamName: 'Team 2' },
          ],
          answers,
        ),
        rounds: [round(100, 0), round(101, 1)],
        roundRatings: [
          { roundId: 100, average: 4.5, count: 2 },
          { roundId: 101, average: 3, count: 1 },
        ],
        questions: [question(11, 100, 0)],
        answers,
        openedQuestionIds: [11],
      }),
    );

    expect(lines).toContain('Rating: 4.5 stars (2 ratings)');
    expect(lines).toContain('Rating: 3.0 stars (1 rating)');
    expect(lines).toContain('Correct rate: 50%');
    expect(lines.filter((l) => l.startsWith('Correct rate'))).toHaveLength(1);
  });

  describe('question blocks', () => {
    it('writes a question with notes, media, counts and wrong answers', () => {
      const brief = briefOfQuestion(
        {
          notes: 'Think of Europe',
          media: { question: 'image', answer: 'video' },
        },
        [
          { ...said(50, 1, 'correct', 'Paris'), pointsAwarded: 2 },
          said(50, 2, 'incorrect', 'London'),
        ],
      );

      expect(questionBlock(brief)).toEqual([
        '',
        '### Q1 (free_text, 2 pts)',
        'The prompt',
        '- Answer: Paris',
        '- Notes: Think of Europe',
        '- Media: image',
        '- Answer media: video',
        '- Answered 2, correct 1, partial 0, correct rate 8%',
        '- Wrong answers: London (1)',
      ]);
    });

    it('writes a bare question with no notes, media or wrong answers', () => {
      const brief = briefOfQuestion({}, [
        { ...said(50, 1, 'correct', 'Paris'), pointsAwarded: 2 },
      ]);

      expect(questionBlock(brief)).toEqual([
        '',
        '### Q1 (free_text, 2 pts)',
        'The prompt',
        '- Answer: Paris',
        '- Answered 1, correct 1, partial 0, correct rate 8%',
      ]);
    });

    it('writes ungraded answers on their own line', () => {
      const brief = briefOfQuestion({}, [said(50, 1, null, 'Parris')]);

      expect(questionBlock(brief).slice(-2)).toEqual([
        '- Answered 1, correct 0, partial 0, correct rate 0%',
        '- Ungraded answers: Parris (1)',
      ]);
    });

    it('writes a closest guess with its answered count but no correct rate', () => {
      const brief = briefOfQuestion({ type: 'closest_guess', answer: '100' }, [
        said(50, 1, 'incorrect', 'abc'),
        said(50, 2, 'incorrect', '10'),
        said(50, 3, 'incorrect', '30'),
      ]);

      expect(questionBlock(brief).slice(-2)).toEqual([
        '- Answered 3, correct 0, partial 0',
        '- Guesses: lowest 10, median 20, highest 30',
      ]);
    });

    it('writes no guesses line when no guess is a number', () => {
      const brief = briefOfQuestion({ type: 'closest_guess', answer: '100' }, [
        said(50, 1, 'incorrect', 'abc'),
      ]);

      expect(questionBlock(brief).slice(-1)).toEqual([
        '- Answered 1, correct 0, partial 0',
      ]);
    });

    it('writes no options line for a multiple_choice question without options', () => {
      for (const options of [undefined, []]) {
        const brief = briefOfQuestion(
          { type: 'multiple_choice', answer: 'Paris', options },
          [said(50, 1, 'incorrect', 'Rome')],
        );

        expect(questionBlock(brief).slice(-1)).toEqual([
          '- Answered 1, correct 0, partial 0, correct rate 0%',
        ]);
      }
    });

    it('writes only the counts for a sort question', () => {
      const brief = briefOfQuestion({ type: 'sort', answer: 'a|b' }, [
        said(50, 1, 'incorrect', 'b|a'),
      ]);

      expect(questionBlock(brief).slice(-1)).toEqual([
        '- Answered 1, correct 0, partial 0, correct rate 0%',
      ]);
    });
  });

  describe('questions never reached', () => {
    const rounds = [round(200, 1), round(100, 0)];
    const questions = [
      question(31, 200, 0),
      question(13, 100, 3),
      question(12, 100, 2),
      question(11, 100, 1),
    ];

    it('without a stored opened list, ends at the last answered question in play order', () => {
      const answers = [said(12, 1, 'incorrect', 'x')];
      const lines = linesOf(
        buildInput({
          standings: standingsFor(TEAMS, answers),
          rounds,
          questions,
          answers,
          openedQuestionIds: null,
        }),
      );

      expect(
        lines.filter((l) => l.startsWith('Prompt') || l.includes('0 answered')),
      ).toEqual(['Prompt 11', 'Prompt 12', 'Prompt 13', 'Prompt 31']);
      expect(lines.filter((l) => l === '- (not played)')).toHaveLength(2);
      expect(lines.indexOf('Prompt 13')).toBeLessThan(
        lines.indexOf('- (not played)'),
      );
      expect(lines.indexOf('Prompt 12')).toBeLessThan(
        lines.indexOf('Prompt 13'),
      );
    });
  });
});
