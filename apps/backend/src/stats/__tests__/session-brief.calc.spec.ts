import { rankTeams } from '@campus-pubquiz/types';
import type { SessionStandings } from '@/standings/standings.service';
import { computeSessionDetail } from '@/stats/session-detail.calc';
import {
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
