import type { GameProgress, LeaderboardEntry } from '@campus-pubquiz/types';
import { computeLeaderboardRevealCount } from '@/game/state/leaderboard-reveal.util';

function progress(overrides: Partial<GameProgress> = {}): GameProgress {
  return {
    status: 'reveal',
    roundIndex: 0,
    questionIndex: 0,
    isLeaderboardVisible: false,
    revealIndex: 0,
    furthestOpenIndex: 0,
    ...overrides,
  };
}

function leaderboardOfSize(size: number): LeaderboardEntry[] {
  return Array.from({ length: size }, (_, index) => ({
    teamId: index + 1,
    teamName: `Team ${index + 1}`,
    totalPoints: size - index,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  }));
}

describe('computeLeaderboardRevealCount', () => {
  it('reveals a kahoot round leaderboard fully at once between questions (question_open)', () => {
    const eightTeams = leaderboardOfSize(8);
    const result = computeLeaderboardRevealCount(
      'ADVANCE',
      false,
      progress({ status: 'question_open', isLeaderboardVisible: true }),
      eightTeams,
      0,
      true,
    );
    // Capped to the top-5 cutoff, not every team — there's nothing left to
    // reveal beyond that on a kahoot leaderboard.
    expect(result).toBe(5);
  });

  it('reveals a kahoot round leaderboard one team at a time at round/quiz end, capped at 5', () => {
    const eightTeams = leaderboardOfSize(8);
    const isKahootRound = true;

    const shown = computeLeaderboardRevealCount(
      'ADVANCE',
      false,
      progress({ status: 'ended', isLeaderboardVisible: true }),
      eightTeams,
      0,
      isKahootRound,
    );
    expect(shown).toBe(0);

    let revealCount = shown;
    for (let click = 1; click <= 6; click++) {
      revealCount = computeLeaderboardRevealCount(
        'REVEAL_NEXT_TEAM',
        true,
        progress({ status: 'ended', isLeaderboardVisible: true }),
        eightTeams,
        revealCount,
        isKahootRound,
      );
      expect(revealCount).toBe(Math.min(click, 5));
    }
  });

  it('reveals a non-kahoot round leaderboard one team at a time through every team, uncapped', () => {
    const eightTeams = leaderboardOfSize(8);
    let revealCount = computeLeaderboardRevealCount(
      'ADVANCE',
      false,
      progress({ status: 'round_intro', isLeaderboardVisible: true }),
      eightTeams,
      0,
      false,
    );
    expect(revealCount).toBe(0);

    for (let click = 1; click <= 8; click++) {
      revealCount = computeLeaderboardRevealCount(
        'REVEAL_NEXT_TEAM',
        true,
        progress({ status: 'round_intro', isLeaderboardVisible: true }),
        eightTeams,
        revealCount,
        false,
      );
      expect(revealCount).toBe(click);
    }
  });

  it('does not reveal fully at once for a kahoot round at round_intro (block end)', () => {
    const eightTeams = leaderboardOfSize(8);
    const result = computeLeaderboardRevealCount(
      'ADVANCE',
      false,
      progress({ status: 'round_intro', isLeaderboardVisible: true }),
      eightTeams,
      0,
      true,
    );
    expect(result).toBe(0);
  });
});
