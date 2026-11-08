import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { InvalidBonusAwardError } from '@/bonus/bonus.service';
import { InvalidShowdownError } from '@/showdown/showdown.service';
import { setupShowdownServiceTest } from '@/showdown/__tests__/showdown-service-test-utils';

describe('ShowdownService (Postgres integration)', () => {
  const { state, insertTeam } = setupShowdownServiceTest();

  it('creates a round with participants seated in the given order', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many students attend this university?',
      '1000',
      5,
    );

    expect(round.question).toBe('How many students attend this university?');
    expect(round.answer).toBe('1000');
    expect(round.resolved).toBe(false);
    expect(round.participants).toEqual([
      { teamId: teamA.id, teamName: 'Team A', seatIndex: 0, guess: null },
      { teamId: teamB.id, teamName: 'Team B', seatIndex: 1, guess: null },
    ]);
  });

  it('rejects a second round while one is still unresolved', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const participants = [
      { teamId: teamA.id, teamName: 'Team A' },
      { teamId: teamB.id, teamName: 'Team B' },
    ];
    await state.showdownService.createRound(
      state.session.id,
      participants,
      'Q1',
      '100',
      5,
    );

    await expect(
      state.showdownService.createRound(
        state.session.id,
        participants,
        'Q2',
        '100',
        5,
      ),
    ).rejects.toThrow(InvalidShowdownError);
  });

  it('rejects fewer than two participants', async () => {
    const teamA = await insertTeam('Team A', 'token-a');

    await expect(
      state.showdownService.createRound(
        state.session.id,
        [{ teamId: teamA.id, teamName: 'Team A' }],
        'Q1',
        '100',
        5,
      ),
    ).rejects.toThrow(InvalidShowdownError);
  });

  it('rejects a non-numeric answer', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');

    await expect(
      state.showdownService.createRound(
        state.session.id,
        [
          { teamId: teamA.id, teamName: 'Team A' },
          { teamId: teamB.id, teamName: 'Team B' },
        ],
        'Q1',
        'not a number',
        5,
      ),
    ).rejects.toThrow(InvalidShowdownError);
  });

  it('submitGuess overwrites a previous guess (last-write-wins)', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'Q1',
      '1000',
      5,
    );

    await state.showdownService.submitGuess(round.id, teamA.id, '900');
    await state.showdownService.submitGuess(round.id, teamA.id, '950');
    await state.showdownService.submitGuess(round.id, teamB.id, '1100');

    const resolution = await state.showdownService.resolve(round.id);
    expect(resolution).toEqual({ winnerTeamId: teamA.id, isTie: false });
  });

  it('rejects a guess from a team that is not part of the round', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const outsider = await insertTeam('Team C', 'token-c');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'Q1',
      '1000',
      5,
    );

    await expect(
      state.showdownService.submitGuess(round.id, outsider.id, '900'),
    ).rejects.toThrow(InvalidShowdownError);
  });

  it("resolve awards the winner's bonus points as a custom bonus, bypassing session category settings", async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many?',
      '1000',
      7,
    );
    await state.showdownService.submitGuess(round.id, teamA.id, '990');
    await state.showdownService.submitGuess(round.id, teamB.id, '1200');

    const resolution = await state.showdownService.resolve(round.id);

    expect(resolution).toEqual({ winnerTeamId: teamA.id, isTie: false });
    const awards = await state.bonusService.listForTeam(
      state.session.id,
      teamA.id,
    );
    expect(awards).toEqual([
      { category: 'custom', points: 7, reason: 'Showdown: "How many?"' },
    ]);
    const loserAwards = await state.bonusService.listForTeam(
      state.session.id,
      teamB.id,
    );
    expect(loserAwards).toEqual([]);
  });

  it('resolve is idempotent — a second call does not double-award', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many?',
      '1000',
      7,
    );
    await state.showdownService.submitGuess(round.id, teamA.id, '990');
    await state.showdownService.submitGuess(round.id, teamB.id, '1200');

    await state.showdownService.resolve(round.id);
    const second = await state.showdownService.resolve(round.id);

    expect(second).toEqual({ winnerTeamId: teamA.id, isTie: false });
    const awards = await state.bonusService.listForTeam(
      state.session.id,
      teamA.id,
    );
    expect(awards).toHaveLength(1);
  });

  it('a resolve whose bonus is refused leaves the round open, so a retry still awards the winner', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many?',
      '1000',
      7,
    );
    await state.showdownService.submitGuess(round.id, teamA.id, '990');
    await state.showdownService.submitGuess(round.id, teamB.id, '1200');
    // The closest team leaves the roster before the reveal, so its bonus is refused.
    await state.em.nativeDelete(GameSessionTeam, {
      gameSession: state.session.id,
      team: teamA.id,
    });
    state.em.clear();

    await expect(state.showdownService.resolve(round.id)).rejects.toThrow(
      InvalidBonusAwardError,
    );

    const now = new Date();
    await state.em.insert(GameSessionTeam, {
      gameSession: state.session.id,
      team: teamA.id,
      createdAt: now,
      updatedAt: now,
    });
    state.em.clear();
    await expect(state.showdownService.resolve(round.id)).resolves.toEqual({
      winnerTeamId: teamA.id,
      isTie: false,
    });
    expect(
      await state.bonusService.listForTeam(state.session.id, teamA.id),
    ).toHaveLength(1);
  });

  it('two or more teams tied for closest resolves as a tie, awarding nothing', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many?',
      '1000',
      7,
    );
    await state.showdownService.submitGuess(round.id, teamA.id, '990');
    await state.showdownService.submitGuess(round.id, teamB.id, '1010');

    const resolution = await state.showdownService.resolve(round.id);

    expect(resolution).toEqual({ winnerTeamId: null, isTie: true });
    const awardsA = await state.bonusService.listForTeam(
      state.session.id,
      teamA.id,
    );
    const awardsB = await state.bonusService.listForTeam(
      state.session.id,
      teamB.id,
    );
    expect(awardsA).toEqual([]);
    expect(awardsB).toEqual([]);
  });

  it('allows a fresh sudden-death round for the still-tied subset once the previous one resolved as a tie', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const first = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'Round 1',
      '1000',
      7,
    );
    await state.showdownService.submitGuess(first.id, teamA.id, '990');
    await state.showdownService.submitGuess(first.id, teamB.id, '1010');
    await state.showdownService.resolve(first.id);

    const second = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'Round 2 (sudden death)',
      '50',
      7,
    );
    expect(second.id).not.toBe(first.id);
  });

  it('treats a blank guess as never winning, not as 0', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many?',
      '1',
      5,
    );
    await state.showdownService.submitGuess(round.id, teamA.id, '');
    await state.showdownService.submitGuess(round.id, teamB.id, '5000');

    const resolution = await state.showdownService.resolve(round.id);
    expect(resolution).toEqual({ winnerTeamId: teamB.id, isTie: false });
  });

  it('treats an unparseable guess as never winning', async () => {
    const teamA = await insertTeam('Team A', 'token-a');
    const teamB = await insertTeam('Team B', 'token-b');
    const round = await state.showdownService.createRound(
      state.session.id,
      [
        { teamId: teamA.id, teamName: 'Team A' },
        { teamId: teamB.id, teamName: 'Team B' },
      ],
      'How many?',
      '1000',
      5,
    );
    await state.showdownService.submitGuess(round.id, teamA.id, 'not a number');
    await state.showdownService.submitGuess(round.id, teamB.id, '5000');

    const resolution = await state.showdownService.resolve(round.id);
    expect(resolution).toEqual({ winnerTeamId: teamB.id, isTie: false });
  });

  describe('refusing a round', () => {
    async function teams() {
      const a = await insertTeam('Team A', 'token-a');
      const b = await insertTeam('Team B', 'token-b');
      return [
        { teamId: a.id, teamName: 'Team A' },
        { teamId: b.id, teamName: 'Team B' },
      ];
    }

    it.each([
      [
        'one team',
        1,
        'Q',
        '100',
        5,
        'A showdown needs at least two tied teams',
      ],
      ['a blank question', 2, '  ', '100', 5, 'A showdown needs a question'],
      ['a blank answer', 2, 'Q', '   ', 5, 'A showdown answer must be numeric'],
      [
        'a word for an answer',
        2,
        'Q',
        'many',
        5,
        'A showdown answer must be numeric',
      ],
      [
        'no points',
        2,
        'Q',
        '100',
        0,
        'Showdown points must be a positive number',
      ],
      [
        'negative points',
        2,
        'Q',
        '100',
        -1,
        'Showdown points must be a positive number',
      ],
      [
        'infinite points',
        2,
        'Q',
        '100',
        Infinity,
        'Showdown points must be a positive number',
      ],
    ])(
      'says why for %s',
      async (_name, count, question, answer, points, message) => {
        const participants = (await teams()).slice(0, count);

        const attempt = state.showdownService.createRound(
          state.session.id,
          participants,
          question,
          answer,
          points,
        );

        await expect(attempt).rejects.toMatchObject({
          name: 'InvalidShowdownError',
          message,
        });
      },
    );

    it('says a round is already in progress', async () => {
      const participants = await teams();
      await state.showdownService.createRound(
        state.session.id,
        participants,
        'Q1',
        '100',
        5,
      );

      await expect(
        state.showdownService.createRound(
          state.session.id,
          participants,
          'Q2',
          '100',
          5,
        ),
      ).rejects.toThrow(
        'A showdown round is already in progress for this session',
      );
    });
  });

  it('stores the trimmed question and answer, numbers rounds within the session, and starts open', async () => {
    const participants = [
      {
        teamId: (await insertTeam('Team A', 'token-a')).id,
        teamName: 'Team A',
      },
      {
        teamId: (await insertTeam('Team B', 'token-b')).id,
        teamName: 'Team B',
      },
    ];
    const otherSession = state.em.create(GameSession, {
      quiz: state.session.quiz,
      joinCode: 'ZZZZZZ',
    });
    await state.em.flush();
    await state.showdownService.createRound(
      otherSession.id,
      participants,
      'Elsewhere',
      '1',
      1,
    );

    const round = await state.showdownService.createRound(
      state.session.id,
      participants,
      '  How many?  ',
      ' 100 ',
      5,
    );

    expect(round).toMatchObject({
      question: 'How many?',
      answer: '100',
      winnerTeamId: null,
      isTie: false,
      resolved: false,
    });
    const stored = await state.em
      .fork()
      .findOneOrFail(ShowdownRound, { id: round.id });
    expect(stored).toMatchObject({
      question: 'How many?',
      answer: '100',
      orderIndex: 0,
    });
  });

  describe('guesses and resolution', () => {
    async function openRound(session = state.session) {
      const a = await insertTeam(`A${session.id}`, `ta${session.id}`);
      const b = await insertTeam(`B${session.id}`, `tb${session.id}`);
      const round = await state.showdownService.createRound(
        session.id,
        [
          { teamId: a.id, teamName: a.name },
          { teamId: b.id, teamName: b.name },
        ],
        'Q',
        '100',
        5,
      );
      return { a, b, round };
    }

    it('refuses a guess once the round is resolved', async () => {
      const { a, round } = await openRound();
      await state.showdownService.submitGuess(round.id, a.id, '90');
      await state.showdownService.resolve(round.id);

      await expect(
        state.showdownService.submitGuess(round.id, a.id, '99'),
      ).rejects.toThrow('This showdown round is no longer accepting guesses');
    });

    it('names a team that is not seated', async () => {
      const { round } = await openRound();
      const outsider = await insertTeam('Outsider', 'token-o');

      await expect(
        state.showdownService.submitGuess(round.id, outsider.id, '1'),
      ).rejects.toThrow('Your team is not part of this showdown round');
    });

    it("decides a round from its own guesses, not another round's", async () => {
      const mine = await openRound();
      const otherSession = state.em.create(GameSession, {
        quiz: state.session.quiz,
        joinCode: 'YYYYYY',
      });
      await state.em.flush();
      const theirs = await openRound(otherSession);
      await state.showdownService.submitGuess(
        theirs.round.id,
        theirs.a.id,
        '100',
      );
      await state.showdownService.submitGuess(mine.round.id, mine.a.id, '90');
      await state.showdownService.submitGuess(mine.round.id, mine.b.id, '50');

      const resolution = await state.showdownService.resolve(mine.round.id);

      expect(resolution).toEqual({ winnerTeamId: mine.a.id, isTie: false });
    });
  });
});
