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
});
