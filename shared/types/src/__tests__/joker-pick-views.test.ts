import { describe, expect, it } from 'vitest';
import { settleSession } from '../session-settle';
import { projectScreen } from '../screen-projection';
import { DEFAULT_SESSION_SETTINGS } from '../session-settings';
import { freshSessionState, type SessionState } from '../session-state';
import { SOCKET_ROOMS } from '../socket-events';
import { JOKER_PICK_SECONDS } from '../joker';
import { lobby } from './game-state-fixtures';

const NOW = 1_700_000_000_000;

/** Two rounds of one free_text question each, with Jokers on, one team that picked round 2 and one that did not. */
function jokerNight(): SessionState {
  const session = freshSessionState({
    quizId: 1,
    gameSessionId: 1,
    joinCode: 'ABCDEF',
    quizTitle: 'Quiz',
    customName: null,
    startedAt: new Date(0),
    rounds: [1, 2].map((number) => ({
      id: number * 10,
      title: `Round ${number}`,
      breakAfter: true,
      category: number === 1 ? 'Music' : undefined,
      questions: [
        {
          id: number * 100,
          type: 'free_text' as const,
          prompt: `Question ${number}?`,
          answer: 'x',
          points: 1,
        },
      ],
    })),
    settings: {
      ...DEFAULT_SESSION_SETTINGS,
      showRoundOverview: true,
      jokersEnabled: true,
    },
  });
  return {
    ...session,
    teams: [
      { teamId: 1, teamName: 'Alpha' },
      { teamId: 2, teamName: 'Bravo' },
    ],
    jokers: { 1: { roundId: 20, source: 'chosen' } },
  };
}

function onPick(session: SessionState): SessionState {
  return settleSession({
    session,
    progress: { ...lobby, status: 'joker_pick' },
    step: { kind: 'transition', action: 'ADVANCE' },
    now: NOW,
  });
}

describe('the joker pick views', () => {
  it('arms the deadline a minute out when the pick opens and clears it on leaving', () => {
    const picking = onPick(jokerNight());
    expect(picking.jokerPickEndsAt).toBe(NOW + JOKER_PICK_SECONDS * 1000);

    const left = settleSession({
      session: picking,
      progress: { ...lobby, status: 'round_intro' },
      step: { kind: 'transition', action: 'ADVANCE' },
      now: NOW + 5_000,
    });
    expect(left.jokerPickEndsAt).toBeNull();
  });

  it('keeps the deadline when a move stays on the pick', () => {
    const picking = onPick(jokerNight());
    const toggled = settleSession({
      session: picking,
      progress: { ...picking.progress, isJoinOverlayVisible: true },
      step: { kind: 'transition', action: 'TOGGLE_JOIN_OVERLAY' },
      now: NOW + 20_000,
    });
    expect(toggled.jokerPickEndsAt).toBe(picking.jokerPickEndsAt);
  });

  it('shows the big screen every round, the deadline and who has picked, but no team’s round', () => {
    const picking = onPick(jokerNight());
    const view = projectScreen(picking, SOCKET_ROOMS.DISPLAY);

    expect(view.jokerPickEndsAt).toBe(picking.jokerPickEndsAt);
    expect(view.screen).toEqual({
      kind: 'joker_pick',
      endsAt: picking.jokerPickEndsAt,
      pickedTeamIds: [1],
      rounds: [
        {
          roundId: 10,
          roundNumber: 1,
          title: 'Round 1',
          category: 'Music',
          author: '',
        },
        {
          roundId: 20,
          roundNumber: 2,
          title: 'Round 2',
          category: '',
          author: '',
        },
      ],
    });
    expect(JSON.stringify(view)).not.toContain('chosen');
  });

  it('offers the players room the deadline and the pickable rounds, with no team’s choice', () => {
    const picking = onPick(jokerNight());
    const view = projectScreen(picking, SOCKET_ROOMS.PLAYERS);

    expect(view.phoneScreen).toEqual({ kind: 'joker_pick', isOpen: true });
    expect(view.jokerPick?.endsAt).toBe(picking.jokerPickEndsAt);
    expect(view.jokerPick?.rounds.map((round) => round.roundId)).toEqual([
      10, 20,
    ]);
    expect(JSON.stringify(view)).not.toContain('chosen');
  });

  it('leaves out of the pick a round with an opened question', () => {
    const picking = { ...onPick(jokerNight()), openedQuestionIds: [100] };
    const view = projectScreen(picking, SOCKET_ROOMS.PLAYERS);

    expect(view.jokerPick?.rounds.map((round) => round.roundId)).toEqual([20]);
  });

  it('has no pick on the players view outside the joker pick', () => {
    const view = projectScreen(jokerNight(), SOCKET_ROOMS.PLAYERS);

    expect(view.jokerPick).toBeNull();
  });

  it('shows the phone a closed pick once the deadline is cleared', () => {
    const closed = { ...onPick(jokerNight()), jokerPickEndsAt: null };
    const view = projectScreen(closed, SOCKET_ROOMS.PLAYERS);

    expect(view.phoneScreen).toEqual({ kind: 'joker_pick', isOpen: false });
    expect(view.jokerPick?.endsAt).toBeNull();
  });

  it('lists every team’s joker with its source to the quiz master', () => {
    const view = projectScreen(onPick(jokerNight()), SOCKET_ROOMS.ADMIN);

    expect(view.onAirScreen).toEqual({ kind: 'joker_pick' });
    expect(view.teams.map((team) => [team.teamName, team.joker])).toEqual([
      [
        'Alpha',
        {
          roundId: 20,
          source: 'chosen',
          roundNumber: 2,
          roundTitle: 'Round 2',
        },
      ],
      ['Bravo', null],
    ]);
  });
});
