import { describe, expect, it, vi } from 'vitest';
import type { GameProgress } from '../game-state';
import { projectScreen } from '../screen-projection';
import type { ActiveShowdownRoundState, SessionState } from '../session-state';
import { SOCKET_ROOMS } from '../socket-events';
import { round, sessionWith } from './session-fixtures';

const threeQuestions = [round(1, [10, 11, 12], { title: 'Alpha' })];

function walkAt(
  status: GameProgress['status'],
  revealIndex: number,
  extra: Partial<GameProgress> = {},
): SessionState {
  return sessionWith(threeQuestions, {
    status,
    roundIndex: 0,
    questionIndex: 2,
    furthestOpenIndex: 2,
    revealIndex,
    ...extra,
  });
}

function playersRevealIds(session: SessionState): number[] {
  return projectScreen(session, SOCKET_ROOMS.PLAYERS).revealQuestions.map(
    ({ id }) => id,
  );
}

describe('projectScreen for the players room: the reveal walk it has shown', () => {
  it('sends the questions before the one on air, and that one too, in reveal', () => {
    expect(playersRevealIds(walkAt('reveal', 1))).toEqual([10, 11]);
  });

  it('sends only the questions before the one being introduced in a reveal intro', () => {
    expect(playersRevealIds(walkAt('reveal_intro', 1))).toEqual([10]);
  });

  it('sends nothing at the first reveal intro', () => {
    expect(playersRevealIds(walkAt('reveal_intro', 0))).toEqual([]);
  });

  it('keeps the whole walk of the block the quiz ended from, answers and all', () => {
    const views = projectScreen(
      walkAt('ended', 1, { previousStatus: 'reveal' }),
      SOCKET_ROOMS.PLAYERS,
    ).revealQuestions;

    expect(views).toHaveLength(2);
    expect(views[1]).toMatchObject({ id: 11, answer: 'Answer 11' });
  });

  it('carries no walk when the quiz ended from a status that is not revealing', () => {
    expect(
      playersRevealIds(walkAt('ended', 1, { previousStatus: 'break' })),
    ).toEqual([]);
    expect(playersRevealIds(walkAt('ended', 1))).toEqual([]);
  });
});

describe('projectScreen for the display room: blank screens', () => {
  it('reports the on-air screen when the display screen had to be blank', () => {
    const onBlankScreen = vi.fn();
    const noDeadline = sessionWith(threeQuestions, {
      status: 'locking',
      furthestOpenIndex: 0,
    });

    const view = projectScreen(noDeadline, SOCKET_ROOMS.DISPLAY, {
      onBlankScreen,
    });

    expect(view.screen).toEqual({ kind: 'blank' });
    expect(onBlankScreen).toHaveBeenCalledOnce();
    expect(onBlankScreen).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'locking' }),
    );
  });

  it('does not report a screen it could draw', () => {
    const onBlankScreen = vi.fn();

    projectScreen(sessionWith(threeQuestions), SOCKET_ROOMS.DISPLAY, {
      onBlankScreen,
    });

    expect(onBlankScreen).not.toHaveBeenCalled();
  });
});

describe('projectScreen for the players room: the showdown phone screen', () => {
  function showdownSession(resolved: boolean): SessionState {
    const activeShowdownRound: ActiveShowdownRoundState = {
      id: 4,
      question: 'How many?',
      answer: '7',
      participants: [],
      winnerTeamId: null,
      isTie: false,
      resolved,
    };
    return { ...walkAt('ended', 0), activeShowdownRound };
  }

  it('asks for guesses while the showdown round is unresolved', () => {
    expect(
      projectScreen(showdownSession(false), SOCKET_ROOMS.PLAYERS).phoneScreen,
    ).toEqual({ kind: 'showdown_guessing' });
  });

  it('shows the reveal once the showdown round is resolved', () => {
    expect(
      projectScreen(showdownSession(true), SOCKET_ROOMS.PLAYERS).phoneScreen,
    ).toEqual({ kind: 'showdown_reveal' });
  });
});
