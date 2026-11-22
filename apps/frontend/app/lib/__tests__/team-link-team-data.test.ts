import { describe, expect, it } from 'vitest';
import type { TeamJoker } from '@campus-pubquiz/types';
import {
  buildMyAnswers,
  buildMyRoundRatings,
  initialTeamLink,
  teamLink,
  type TeamLinkCommand,
  type TeamLinkInput,
  type TeamLinkState,
} from '@/app/lib/team-link';
import { NOT_CONNECTED_MESSAGE } from '@/app/lib/connection-messages';
import { joinAccepted, teamView } from '@/test-utils/team-view';

const GRADED = {
  questionId: 20,
  value: 'Paris',
  pointsAwarded: 2,
  gradedAt: '2026-10-01T10:00:00.000Z',
  clue: null,
  clueValue: null,
  verdict: 'correct',
} as const;

const PARIS_GRADE = {
  pointsAwarded: 2,
  gradedAt: GRADED.gradedAt,
  verdict: 'correct',
};

const WAITING = {
  questionId: 21,
  value: 'Banana',
  pointsAwarded: 0,
  gradedAt: null,
  clue: null,
  clueValue: null,
  verdict: null,
} as const;

type AcceptedFields = Parameters<typeof joinAccepted>[0];

const ACCEPTED: AcceptedFields = {
  teamId: 31,
  teamName: 'The Quizzards',
  teamToken: 'token-2',
  teamCode: 'CODE',
  answers: [GRADED, WAITING],
  bonusAwards: [{ category: 'shot', points: 1 }],
  roundRatings: [{ roundId: 11, stars: 4 }],
  feedback: { comment: 'Loved it', topics: ['Geography'] },
  sessionRatings: { pacing: null, feltDifficulty: null },
  playerCount: null,
  joker: null,
  coins: 0,
  hasCarriedCoin: false,
  purchases: [],
  sideId: null,
  roomReadyQuestionIds: [],
};

const STORED = {
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  gameCode: 'ABCDEF',
};

function run(start: TeamLinkState, ...inputs: TeamLinkInput[]) {
  let state = start;
  const commands: TeamLinkCommand[] = [];
  for (const input of inputs) {
    const result = teamLink(state, input);
    state = result.state;
    commands.push(...result.commands);
  }
  return { state, commands };
}

function connected(connectionId: number) {
  return {
    type: 'connected',
    connectionId,
    socketId: `socket-${connectionId}`,
  } as const;
}

function accepted(payload: AcceptedFields = ACCEPTED) {
  return { type: 'joinAccepted', payload: joinAccepted(payload) } as const;
}

function submit(value = 'Banana', questionId = 21) {
  return { type: 'answerSubmitted', questionId, teamId: 31, value } as const;
}

/** A phone linked on connection 1. */
function linkedPhone() {
  return run(
    initialTeamLink({ url: {}, stored: STORED }),
    connected(1),
    accepted(),
  ).state;
}

/** The team view the phone holds. */
function held(state: TeamLinkState) {
  return state.team?.teamView;
}

function answersOf(state: TeamLinkState) {
  return buildMyAnswers(held(state)?.answers ?? []);
}

function ofType<T extends TeamLinkCommand['type']>(
  commands: TeamLinkCommand[],
  type: T,
) {
  return commands.filter(
    (command): command is Extract<TeamLinkCommand, { type: T }> =>
      command.type === type,
  );
}

describe('team link: the team data', () => {
  it('restores answers, grades, bonus awards, ratings and feedback wholesale on join accepted', () => {
    const { state } = run(
      linkedPhone(),
      accepted({ ...ACCEPTED, answers: [GRADED], bonusAwards: [] }),
    );

    expect(state.team?.teamId).toBe(31);
    expect(answersOf(state)).toEqual({
      20: { value: 'Paris', grade: PARIS_GRADE, clue: null },
    });
    expect(held(state)?.bonusAwards).toEqual([]);
    expect(buildMyRoundRatings(held(state)?.roundRatings ?? [])).toEqual({
      11: 4,
    });
    expect(held(state)?.feedback).toEqual({
      comment: 'Loved it',
      topics: ['Geography'],
    });
  });

  it('grades only the answers that were graded', () => {
    expect(answersOf(linkedPhone())).toEqual({
      20: { value: 'Paris', grade: PARIS_GRADE, clue: null },
      21: { value: 'Banana', grade: null, clue: null },
    });
  });

  it('drops the old grade when a team view brings a revised answer ungraded', () => {
    const { state } = run(linkedPhone(), {
      type: 'teamViewReceived',
      view: teamView({
        answers: [
          {
            ...GRADED,
            value: 'Lyon',
            pointsAwarded: 0,
            gradedAt: null,
            verdict: null,
          },
        ],
      }),
    });

    expect(answersOf(state)[20]).toEqual({
      value: 'Lyon',
      grade: null,
      clue: null,
    });
  });

  it('carries a Clue answer’s recorded clue and its worth from a team view, and drops it when the view has none', () => {
    const answer = { ...WAITING, value: 'Curie', clue: 2, clueValue: 1 };
    const clued = run(linkedPhone(), {
      type: 'teamViewReceived',
      view: teamView({ answers: [answer] }),
    }).state;
    expect(answersOf(clued)[21]).toEqual({
      value: 'Curie',
      grade: null,
      clue: { clue: 2, value: 1 },
    });

    const cleared = run(clued, {
      type: 'teamViewReceived',
      view: teamView({
        answers: [{ ...answer, value: '', clue: null, clueValue: null }],
      }),
    }).state;
    expect(answersOf(cleared)[21].clue).toBeNull();
  });

  it('replaces answers and grades when a team view arrives', () => {
    const { state } = run(linkedPhone(), {
      type: 'teamViewReceived',
      view: teamView({
        answers: [{ ...GRADED, questionId: 30, value: 'Oslo' }],
      }),
    });

    expect(answersOf(state)).toEqual({
      30: { value: 'Oslo', grade: PARIS_GRADE, clue: null },
    });
  });

  it('toasts a live bonus award without touching the list (the team view carries it); awards restored on join are not toasted', () => {
    const restored = run(
      initialTeamLink({ url: {}, stored: STORED }),
      accepted(),
    );
    expect(ofType(restored.commands, 'toast')).toEqual([]);

    const live = run(linkedPhone(), {
      type: 'bonusAwarded',
      payload: { category: 'selfie', points: 2 },
    });
    expect(live.state.team).toEqual(linkedPhone().team);
    const toasts = ofType(live.commands, 'toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ tone: 'success' });
    expect(toasts[0].message).toContain('+2 points');

    const penalty = run(linkedPhone(), {
      type: 'bonusAwarded',
      payload: { category: 'shot', points: -1 },
    });
    expect(ofType(penalty.commands, 'toast')[0]).toMatchObject({
      tone: 'neutral',
    });
  });

  describe('the coins', () => {
    it('toasts coins the quiz master gave and leaves the balance to the team view', () => {
      const before = linkedPhone();
      const gained = run(before, {
        type: 'coinAwarded',
        payload: { coins: 2, balance: 3, reason: 'Trivia hero' },
      });

      expect(gained.state.team?.teamView.coins).toBe(
        before.team?.teamView.coins,
      );
      expect(ofType(gained.commands, 'toast')).toEqual([
        expect.objectContaining({
          tone: 'success',
          message: expect.stringContaining('+2 coins') as string,
        }),
      ]);
      expect(ofType(gained.commands, 'toast')[0].message).toContain(
        'Trivia hero',
      );
    });

    it('toasts a single coin in the singular and coins taken as neutral', () => {
      const one = run(linkedPhone(), {
        type: 'coinAwarded',
        payload: { coins: 1, balance: 1 },
      });
      expect(ofType(one.commands, 'toast')[0].message).toContain('+1 coin');
      expect(ofType(one.commands, 'toast')[0].message).not.toContain('coins');

      const taken = run(linkedPhone(), {
        type: 'coinAwarded',
        payload: { coins: -2, balance: 0 },
      });
      expect(ofType(taken.commands, 'toast')[0]).toMatchObject({
        tone: 'neutral',
      });
      expect(ofType(taken.commands, 'toast')[0].message).toContain('-2 coins');
    });

    it('toasts a zero award plainly: no plus sign, no coin emoji, neutral', () => {
      const none = run(linkedPhone(), {
        type: 'coinAwarded',
        payload: { coins: 0, balance: 3 },
      });
      expect(ofType(none.commands, 'toast')[0]).toMatchObject({
        tone: 'neutral',
        message: '0 coins',
      });
    });

    it('marks only a gain with the coin emoji', () => {
      const gained = run(linkedPhone(), {
        type: 'coinAwarded',
        payload: { coins: 2, balance: 2 },
      });
      const taken = run(linkedPhone(), {
        type: 'coinAwarded',
        payload: { coins: -2, balance: 0 },
      });
      expect(ofType(gained.commands, 'toast')[0].message).toBe('🪙 +2 coins');
      expect(ofType(taken.commands, 'toast')[0].message).toBe('-2 coins');
    });

    it('updates the balance quietly when a team view says it changed', () => {
      const synced = run(linkedPhone(), {
        type: 'teamViewReceived',
        view: teamView({ coins: 5, hasCarriedCoin: true }),
      });

      expect(synced.state.team?.teamView.coins).toBe(5);
      expect(synced.state.team?.teamView.hasCarriedCoin).toBe(true);
      expect(ofType(synced.commands, 'toast')).toEqual([]);
    });
  });

  describe('the joker', () => {
    const viewWith = (joker: TeamJoker): TeamLinkInput => ({
      type: 'teamViewReceived',
      view: teamView({ joker }),
    });

    it('takes the doubled rounds and joker extras from a team view, on a join and a replace', () => {
      const doubledRounds = [{ roundId: 12, roundNumber: 2, title: 'Music' }];
      const view = teamView({ doubledRounds, jokerExtras: { 20: 2 } });

      const replaced = run(linkedPhone(), {
        type: 'teamViewReceived',
        view,
      }).state;
      const joined = run(
        initialTeamLink({ url: {}, stored: STORED }),
        accepted({ ...ACCEPTED }),
        { type: 'teamViewReceived', view },
      ).state;

      for (const state of [replaced, joined]) {
        expect(held(state)?.doubledRounds).toEqual(doubledRounds);
        expect(held(state)?.jokerExtras).toEqual({ 20: 2 });
      }
    });

    it('toasts a joker the quiz master set, and one drawn for the team', () => {
      const bySetting = run(
        linkedPhone(),
        viewWith({ roundId: 12, source: 'set_by_quiz_master' }),
      );
      expect(held(bySetting.state)?.joker).toEqual({
        roundId: 12,
        source: 'set_by_quiz_master',
      });
      expect(ofType(bySetting.commands, 'toast')).toEqual([
        expect.objectContaining({
          message: 'Your joker was changed by the quiz master',
        }),
      ]);

      const byDraw = run(
        linkedPhone(),
        viewWith({ roundId: 12, source: 'drawn' }),
      );
      expect(ofType(byDraw.commands, 'toast')).toEqual([
        expect.objectContaining({ message: 'A joker was drawn for your team' }),
      ]);
    });

    it('does not toast the team’s own pick', () => {
      const { commands } = run(
        linkedPhone(),
        viewWith({ roundId: 12, source: 'chosen' }),
      );
      expect(ofType(commands, 'toast')).toEqual([]);
    });

    it('does not toast a joker it already holds, as when the pick closes and re-sends every joker', () => {
      const held = run(
        linkedPhone(),
        viewWith({ roundId: 12, source: 'set_by_quiz_master' }),
      ).state;

      const { commands } = run(
        held,
        viewWith({ roundId: 12, source: 'set_by_quiz_master' }),
      );
      expect(ofType(commands, 'toast')).toEqual([]);
    });

    it('does not toast a joker restored by a join (a reconnect only updates the chip)', () => {
      const { state, commands } = run(
        initialTeamLink({ url: {}, stored: STORED }),
        accepted({
          ...ACCEPTED,
          joker: { roundId: 12, source: 'set_by_quiz_master' },
        }),
      );
      expect(held(state)?.joker).toEqual({
        roundId: 12,
        source: 'set_by_quiz_master',
      });
      expect(ofType(commands, 'toast')).toEqual([]);
    });
  });

  it('shows only what the server holds after a rejoin', () => {
    const rejoined = run(
      linkedPhone(),
      { type: 'disconnected' },
      connected(2),
      accepted(),
    );
    expect(held(rejoined.state)?.roundRatings).toEqual([
      { roundId: 11, stars: 4 },
    ]);
  });

  it('restores the pacing and felt-difficulty answers on join', () => {
    const joined = run(
      linkedPhone(),
      accepted({
        ...ACCEPTED,
        sessionRatings: { pacing: 'too_slow', feltDifficulty: null },
      }),
    );
    expect(held(joined.state)?.sessionRatings).toEqual({
      pacing: 'too_slow',
      feltDifficulty: null,
    });
  });

  it('has no player count until the join carries one, then follows the server: join and sync', () => {
    expect(held(linkedPhone())?.playerCount).toBeNull();

    const joined = run(
      linkedPhone(),
      accepted({ ...ACCEPTED, playerCount: 4 }),
    );
    expect(held(joined.state)?.playerCount).toBe(4);

    const synced = run(joined.state, {
      type: 'teamViewReceived',
      view: teamView({ playerCount: 6 }),
    });
    expect(held(synced.state)?.playerCount).toBe(6);
  });

  it('drops the held team view on a new connection identity until the new join answers', () => {
    const { state } = run(linkedPhone(), { type: 'identityChanged' });

    expect(state).toMatchObject({ team: null, isLinked: false });
  });
});

describe('team link: the pending answer', () => {
  it('sends the answer and arms the confirmation timer for that attempt when linked', () => {
    const { commands } = run(linkedPhone(), submit());

    expect(ofType(commands, 'sendAnswer')).toEqual([
      {
        type: 'sendAnswer',
        attempt: 1,
        payload: { questionId: 21, teamId: 31, value: 'Banana' },
      },
    ]);
    expect(ofType(commands, 'armConfirmTimer')).toEqual([
      { type: 'armConfirmTimer', attempt: 1 },
    ]);
  });

  it('toasts "not connected" and sends nothing when not linked', () => {
    const { commands, state } = run(
      initialTeamLink({ url: {}, stored: STORED }),
      connected(1),
      submit(),
    );

    expect(ofType(commands, 'sendAnswer')).toEqual([]);
    expect(ofType(commands, 'toast')).toEqual([
      { type: 'toast', tone: 'error', message: NOT_CONNECTED_MESSAGE },
    ]);
    expect(state.pendingAnswer).toBeNull();
  });

  it('lets a later submit supersede the earlier one', () => {
    const { state, commands } = run(linkedPhone(), submit('A'), submit('B'));

    expect(ofType(commands, 'sendAnswer').map((c) => c.attempt)).toEqual([
      1, 2,
    ]);
    expect(state.pendingAnswer).toMatchObject({ value: 'B' });
  });

  it('clears the pending answer on an acknowledgement', () => {
    const { state, commands } = run(linkedPhone(), submit(), {
      type: 'answerResult',
      attempt: 1,
      result: { success: true },
    });

    expect(state.pendingAnswer).toBeNull();
    expect(commands).toContainEqual({ type: 'clearConfirmTimer' });
  });

  it('toasts a refusal and never resends it', () => {
    const refused = run(linkedPhone(), submit(), {
      type: 'answerResult',
      attempt: 1,
      result: { success: false, error: 'Answers are locked for this question' },
    });
    expect(ofType(refused.commands, 'toast')).toContainEqual({
      type: 'toast',
      tone: 'error',
      message: 'Answers are locked for this question',
    });
    expect(refused.state.pendingAnswer).toBeNull();

    const rejoined = run(
      refused.state,
      { type: 'disconnected' },
      connected(2),
      accepted(),
    );
    expect(ofType(rejoined.commands, 'sendAnswer')).toEqual([]);
  });

  it('ignores a result for an older attempt', () => {
    const { state } = run(linkedPhone(), submit('A'), submit('B'), {
      type: 'answerResult',
      attempt: 1,
      result: { success: true },
    });

    expect(state.pendingAnswer).toMatchObject({ value: 'B' });
  });

  it('ignores a timeout for an older attempt', () => {
    const { state, commands } = run(linkedPhone(), submit('A'), submit('B'), {
      type: 'answerTimedOut',
      attempt: 1,
    });

    expect(state.isLinked).toBe(true);
    expect(ofType(commands, 'forceReconnect')).toEqual([]);
  });

  it('keeps an answer that was never delivered pending without forcing a reconnect', () => {
    const { state, commands } = run(linkedPhone(), submit(), {
      type: 'answerNotDelivered',
      attempt: 1,
    });

    expect(state.pendingAnswer).toMatchObject({ value: 'Banana' });
    expect(ofType(commands, 'forceReconnect')).toEqual([]);
    expect(ofType(commands, 'toast')).toEqual([]);
    expect(commands).toContainEqual({ type: 'clearConfirmTimer' });
  });

  it('unlinks the phone and forces a reconnect on a timeout, keeping the answer pending', () => {
    const { state, commands } = run(linkedPhone(), submit(), {
      type: 'answerTimedOut',
      attempt: 1,
    });

    expect(state.isLinked).toBe(false);
    expect(state.pendingAnswer).not.toBeNull();
    expect(ofType(commands, 'forceReconnect')).toHaveLength(1);
  });

  it('resends the answer exactly once after the connection drops, reconnects and the join is accepted', () => {
    const { commands } = run(
      linkedPhone(),
      submit(),
      { type: 'disconnected' },
      connected(2),
      accepted(),
      { type: 'answerResult', attempt: 2, result: { success: true } },
      accepted(),
    );

    const sends = ofType(commands, 'sendAnswer');
    expect(sends).toEqual([
      {
        type: 'sendAnswer',
        attempt: 1,
        payload: { questionId: 21, teamId: 31, value: 'Banana' },
      },
      {
        type: 'sendAnswer',
        attempt: 2,
        payload: { questionId: 21, teamId: 31, value: 'Banana' },
      },
    ]);
    expect(ofType(commands, 'armConfirmTimer')).toContainEqual({
      type: 'armConfirmTimer',
      attempt: 2,
    });
  });

  it('stops the timer when the connection drops and resends nothing until the join is accepted', () => {
    const { commands } = run(linkedPhone(), submit(), {
      type: 'disconnected',
    });

    expect(ofType(commands, 'sendAnswer')).toHaveLength(1);
    expect(commands).toContainEqual({ type: 'clearConfirmTimer' });
  });

  it('drops the pending answer when the connection identity changes', () => {
    const { state } = run(linkedPhone(), submit(), { type: 'identityChanged' });

    expect(state.pendingAnswer).toBeNull();
  });
});

describe('team link: a team view', () => {
  it('replaces the team data wholesale, including coins, and fires nothing', () => {
    const view = teamView({
      answers: [WAITING],
      playerCount: 5,
      coins: 4,
      hasCarriedCoin: true,
      joker: { roundId: 3, source: 'chosen' },
      sideId: 'red',
    });

    const { state, commands } = run(linkedPhone(), {
      type: 'teamViewReceived',
      view,
    });

    expect(state.team?.teamView).toEqual(view);
    expect(commands).toEqual([]);
  });

  it('is not held before a join has been accepted', () => {
    const { state } = run(initialTeamLink({ url: {}, stored: STORED }), {
      type: 'teamViewReceived',
      view: teamView({ playerCount: 5 }),
    });

    expect(state.team).toBeNull();
  });

  it('keeps the join reply identity when the view replaces', () => {
    const { state } = run(linkedPhone(), {
      type: 'teamViewReceived',
      view: teamView(),
    });

    expect(state.team).toMatchObject({ teamId: 31, teamToken: 'token-2' });
  });

  it('keeps the pending answer and its attempt', () => {
    const pending = run(linkedPhone(), submit()).state;

    const { state } = run(pending, {
      type: 'teamViewReceived',
      view: teamView(),
    });

    expect(state.pendingAnswer).toEqual(pending.pendingAnswer);
    expect(state.answerAttempt).toBe(pending.answerAttempt);
  });

  it('is where a join accepted takes its data from', () => {
    const payload = {
      ...joinAccepted(ACCEPTED),
      answers: [],
      teamView: teamView({ playerCount: 9 }),
    };

    const { state } = run(
      initialTeamLink({ url: {}, stored: STORED }),
      connected(1),
      { type: 'joinAccepted', payload },
    );

    expect(state.team?.teamView).toEqual(payload.teamView);
  });
});

describe('team link: leaving a session drops the team data', () => {
  it.each(['kicked', 'sessionClosed', 'logoutRequested'] as const)(
    'on %s, forgets the team, the link and the pending answer, and stops the timer',
    (type) => {
      const { state, commands } = run(linkedPhone(), submit(), { type });

      expect(state).toMatchObject({
        team: null,
        isLinked: false,
        linkedSocketId: null,
        lastStatus: null,
        pendingAnswer: null,
      });
      expect(commands).toContainEqual({ type: 'clearConfirmTimer' });
    },
  );

  it("never resends the old team's answer when another team joins afterwards", () => {
    const { commands } = run(
      linkedPhone(),
      submit(),
      { type: 'kicked' },
      { type: 'nameTyped', value: 'Other Team' },
      { type: 'gameCodeTyped', value: 'zzzzzz' },
      { type: 'joinSubmitted' },
      connected(2),
      accepted({ ...ACCEPTED, teamId: 77, teamName: 'Other Team' }),
    );

    expect(ofType(commands, 'sendAnswer')).toHaveLength(1);
  });
});
