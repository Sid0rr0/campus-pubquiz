import {
  DEFAULT_SESSION_SETTINGS,
  freshSessionState,
  type GameProgress,
  type SeededQuestion,
  type SeededRound,
  type SessionState,
} from '@campus-pubquiz/types';
import { SEEDED_GAME_SUMMARY_DEFAULTS } from '@/game/__tests__/seeded-game-defaults';
import { describeScreen } from '@/game/state/screen-preview.util';

function question(id: number): SeededQuestion {
  return {
    id,
    type: 'free_text',
    prompt: `Question ${id}`,
    options: [],
    points: 1,
    answer: `Answer ${id}`,
  } as unknown as SeededQuestion;
}

// Two blocks of one round each, one question apiece: ids 10 | 20.
const ROUNDS: SeededRound[] = [
  { id: 1, title: 'Alpha', breakAfter: true, questions: [question(10)] },
  { id: 2, title: 'Beta', breakAfter: true, questions: [question(20)] },
];

function session(progress: Partial<GameProgress>): SessionState {
  return freshSessionState(
    {
      quizId: 1,
      gameSessionId: 1,
      joinCode: 'ABCDEF',
      ...SEEDED_GAME_SUMMARY_DEFAULTS,
      rounds: ROUNDS,
      settings: DEFAULT_SESSION_SETTINGS,
    },
    {
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      isJoinOverlayVisible: false,
      revealIndex: 0,
      furthestOpenIndex: 0,
      ...progress,
    },
  );
}

describe('describeScreen — the words for the screen on air', () => {
  it('lists every round title on the round overview', () => {
    expect(describeScreen(session({ status: 'round_overview' }))).toEqual({
      heading: 'Round overview',
      body: 'Alpha · Beta',
    });
  });

  it('names the joker pick and the join overlay', () => {
    expect(describeScreen(session({ status: 'joker_pick' }))).toEqual({
      heading: 'Joker pick',
      body: 'Teams choose their joker round',
    });
    expect(
      describeScreen(session({ status: 'rules', isJoinOverlayVisible: true })),
    ).toEqual({ heading: 'Join overlay' });
  });

  it('names the block question being reviewed in the break, with its prompt', () => {
    expect(
      describeScreen(session({ status: 'break', revealIndex: 0 })),
    ).toEqual({
      heading: 'Break · Reviewing R1 Q1',
      body: 'Question 10',
    });
  });

  it('names the round being stepped across in the break', () => {
    expect(
      describeScreen(session({ status: 'break_round_intro', revealIndex: 0 })),
    ).toEqual({ heading: 'Break · Round 1 title', body: 'Alpha' });
  });

  it('falls back to the break intro when the break step names no question', () => {
    const intro = { heading: 'Break 1', body: 'After round 1' };

    expect(
      describeScreen(session({ status: 'break', revealIndex: 5 })),
    ).toEqual(intro);
    expect(
      describeScreen(session({ status: 'break_round_intro', revealIndex: 5 })),
    ).toEqual(intro);
  });

  it('says only that answers are being revealed when the reveal step names no question', () => {
    expect(
      describeScreen(session({ status: 'reveal_intro', revealIndex: 5 })),
    ).toEqual({ heading: 'Revealing answers' });
    expect(
      describeScreen(session({ status: 'reveal', revealIndex: 5 })),
    ).toEqual({ heading: 'Revealing answers' });
  });
});
