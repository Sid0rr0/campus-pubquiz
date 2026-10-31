import { describe, expect, it } from 'vitest';
import type { JoinAcceptedPayload } from '@campus-pubquiz/types';
import {
  initialTeamLink,
  teamLink,
  type TeamLinkCommand,
  type TeamLinkInput,
  type TeamLinkState,
} from '@/app/lib/team-link';
import { NOT_CONNECTED_MESSAGE } from '@/app/lib/connection-messages';

const GRADED = {
  questionId: 20,
  value: 'Paris',
  pointsAwarded: 2,
  gradedAt: '2026-10-01T10:00:00.000Z',
  verdict: 'correct',
} as const;

const WAITING = {
  questionId: 21,
  value: 'Banana',
  pointsAwarded: 0,
  gradedAt: null,
  verdict: null,
} as const;

const ACCEPTED: JoinAcceptedPayload = {
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

function accepted(payload: JoinAcceptedPayload = ACCEPTED) {
  return { type: 'joinAccepted', payload } as const;
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
  it('restores answers, grades, bonus awards, ratings and feedback wholesale on join accepted, and bumps the ratings epoch', () => {
    const { state } = run(
      linkedPhone(),
      { type: 'ratingSaved', roundId: 99, stars: 1 },
      accepted({ ...ACCEPTED, answers: [GRADED], bonusAwards: [] }),
    );

    expect(state.team?.teamId).toBe(31);
    expect(state.myAnswers).toEqual({ 20: 'Paris' });
    expect(state.myAnswerGrades).toEqual({
      20: { pointsAwarded: 2, gradedAt: GRADED.gradedAt, verdict: 'correct' },
    });
    expect(state.myBonusAwards).toEqual([]);
    expect(state.myRoundRatings).toEqual({ 11: 4 });
    expect(state.myFeedback).toEqual({
      comment: 'Loved it',
      topics: ['Geography'],
    });
    expect(state.roundRatingsEpoch).toBe(2);
  });

  it('grades only the answers that were graded', () => {
    expect(linkedPhone().myAnswers).toEqual({ 20: 'Paris', 21: 'Banana' });
    expect(Object.keys(linkedPhone().myAnswerGrades)).toEqual(['20']);
  });

  it('updates just that answer on answer received, with its grade when graded automatically', () => {
    const received = {
      questionId: 22,
      teamId: 31,
      teamName: 'The Quizzards',
      value: 'Rome',
      pointsAwarded: 1,
      gradedAt: '2026-10-01T11:00:00.000Z',
      verdict: 'correct',
    } as const;

    const graded = run(linkedPhone(), {
      type: 'answerReceived',
      payload: received,
    }).state;
    expect(graded.myAnswers).toEqual({ 20: 'Paris', 21: 'Banana', 22: 'Rome' });
    expect(graded.myAnswerGrades[22]).toEqual({
      pointsAwarded: 1,
      gradedAt: received.gradedAt,
      verdict: 'correct',
    });
    expect(graded.myAnswerGrades[20]).toBeDefined();

    const waiting = run(linkedPhone(), {
      type: 'answerReceived',
      payload: { ...received, gradedAt: null, verdict: null, pointsAwarded: 0 },
    }).state;
    expect(waiting.myAnswers[22]).toBe('Rome');
    expect(waiting.myAnswerGrades).not.toHaveProperty('22');
  });

  it('replaces answers and grades when the team answers are synced', () => {
    const { state } = run(linkedPhone(), {
      type: 'teamAnswersSynced',
      answers: [{ ...GRADED, questionId: 30, value: 'Oslo' }],
    });

    expect(state.myAnswers).toEqual({ 30: 'Oslo' });
    expect(Object.keys(state.myAnswerGrades)).toEqual(['30']);
  });

  it('appends a live bonus award and toasts it; awards restored on join are not toasted', () => {
    const restored = run(
      initialTeamLink({ url: {}, stored: STORED }),
      accepted(),
    );
    expect(ofType(restored.commands, 'toast')).toEqual([]);

    const live = run(linkedPhone(), {
      type: 'bonusAwarded',
      payload: { category: 'selfie', points: 2 },
    });
    expect(live.state.myBonusAwards).toHaveLength(2);
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
    it('toasts coins the quiz master gave and shows the new balance', () => {
      const gained = run(linkedPhone(), {
        type: 'coinAwarded',
        payload: { coins: 2, balance: 3, reason: 'Trivia hero' },
      });

      expect(gained.state.team?.coins).toBe(3);
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
      expect(taken.state.team?.coins).toBe(0);
      expect(ofType(taken.commands, 'toast')[0]).toMatchObject({
        tone: 'neutral',
      });
      expect(ofType(taken.commands, 'toast')[0].message).toContain('-2 coins');
    });

    it('updates the balance quietly when a sync says it changed', () => {
      const synced = run(linkedPhone(), {
        type: 'coinsSynced',
        payload: { balance: 5, hasCarriedCoin: true },
      });

      expect(synced.state.team?.coins).toBe(5);
      expect(synced.state.team?.hasCarriedCoin).toBe(true);
      expect(ofType(synced.commands, 'toast')).toEqual([]);
    });
  });

  describe('the joker', () => {
    it('toasts a joker the quiz master set, and one drawn for the team', () => {
      const bySetting = run(linkedPhone(), {
        type: 'jokerSynced',
        joker: { roundId: 12, source: 'set_by_quiz_master' },
      });
      expect(bySetting.state.myJoker).toEqual({
        roundId: 12,
        source: 'set_by_quiz_master',
      });
      expect(ofType(bySetting.commands, 'toast')).toEqual([
        expect.objectContaining({
          message: 'Your joker was changed by the quiz master',
        }),
      ]);

      const byDraw = run(linkedPhone(), {
        type: 'jokerSynced',
        joker: { roundId: 12, source: 'drawn' },
      });
      expect(ofType(byDraw.commands, 'toast')).toEqual([
        expect.objectContaining({ message: 'A joker was drawn for your team' }),
      ]);
    });

    it('does not toast the team’s own pick', () => {
      const { commands } = run(linkedPhone(), {
        type: 'jokerSynced',
        joker: { roundId: 12, source: 'chosen' },
      });
      expect(ofType(commands, 'toast')).toEqual([]);
    });

    it('does not toast a joker it already holds, as when the pick closes and re-sends every joker', () => {
      const held = run(linkedPhone(), {
        type: 'jokerSynced',
        joker: { roundId: 12, source: 'set_by_quiz_master' },
      }).state;

      const { commands } = run(held, {
        type: 'jokerSynced',
        joker: { roundId: 12, source: 'set_by_quiz_master' },
      });
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
      expect(state.myJoker).toEqual({
        roundId: 12,
        source: 'set_by_quiz_master',
      });
      expect(ofType(commands, 'toast')).toEqual([]);
    });
  });

  it('keeps an acknowledged rating and feedback, but not one the server never saw, across a rejoin', () => {
    const { state } = run(
      linkedPhone(),
      { type: 'ratingSaved', roundId: 12, stars: 5 },
      {
        type: 'feedbackSaved',
        feedback: { comment: 'Great', topics: ['Music'] },
      },
    );
    expect(state.myRoundRatings).toEqual({ 11: 4, 12: 5 });
    expect(state.myFeedback).toEqual({ comment: 'Great', topics: ['Music'] });

    // A tap that never reached the server sends no event, so a rejoin shows
    // only what the server holds.
    const rejoined = run(
      linkedPhone(),
      { type: 'disconnected' },
      connected(2),
      accepted(),
    );
    expect(rejoined.state.myRoundRatings).toEqual({ 11: 4 });
  });

  it('restores the pacing and felt-difficulty answers on join, and keeps an acknowledged one on its own scale', () => {
    const joined = run(
      linkedPhone(),
      accepted({
        ...ACCEPTED,
        sessionRatings: { pacing: 'too_slow', feltDifficulty: null },
      }),
    );
    expect(joined.state.mySessionRatings).toEqual({
      pacing: 'too_slow',
      feltDifficulty: null,
    });

    const saved = run(joined.state, {
      type: 'sessionRatingSaved',
      rating: { scale: 'feltDifficulty', value: 'too_hard' },
    });
    expect(saved.state.mySessionRatings).toEqual({
      pacing: 'too_slow',
      feltDifficulty: 'too_hard',
    });
  });

  it('has no pacing or felt-difficulty answer before a join or after the identity changes', () => {
    const { state } = run(
      linkedPhone(),
      {
        type: 'sessionRatingSaved',
        rating: { scale: 'pacing', value: 'too_fast' },
      },
      { type: 'identityChanged' },
    );

    expect(state.mySessionRatings).toEqual({
      pacing: null,
      feltDifficulty: null,
    });
  });

  it('has no player count until the join carries one, then follows the server: join, sync and a saved send', () => {
    expect(linkedPhone().myPlayerCount).toBeNull();

    const joined = run(
      linkedPhone(),
      accepted({ ...ACCEPTED, playerCount: 4 }),
    );
    expect(joined.state.myPlayerCount).toBe(4);

    const synced = run(joined.state, {
      type: 'playerCountSynced',
      playerCount: 6,
    });
    expect(synced.state.myPlayerCount).toBe(6);

    const saved = run(linkedPhone(), {
      type: 'playerCountSaved',
      playerCount: 3,
    });
    expect(saved.state.myPlayerCount).toBe(3);
  });

  it('clears the previous team data on a new connection identity until the new join answers', () => {
    const { state } = run(
      linkedPhone(),
      { type: 'playerCountSaved', playerCount: 3 },
      { type: 'identityChanged' },
    );

    expect(state).toMatchObject({
      myPlayerCount: null,
      team: null,
      isLinked: false,
      myAnswers: {},
      myAnswerGrades: {},
      myBonusAwards: [],
      myRoundRatings: {},
      myFeedback: { comment: '', topics: [] },
    });
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
        myAnswers: {},
        myAnswerGrades: {},
        myBonusAwards: [],
        myRoundRatings: {},
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

  it('never repeats a ratings epoch, so a clear and the next join always change it', () => {
    const epochs = [linkedPhone()].flatMap((linked) => {
      const left = run(linked, { type: 'identityChanged' }).state;
      const rejoined = run(left, connected(2), accepted()).state;
      return [
        linked.roundRatingsEpoch,
        left.roundRatingsEpoch,
        rejoined.roundRatingsEpoch,
      ];
    });

    expect(new Set(epochs).size).toBe(epochs.length);
  });
});
