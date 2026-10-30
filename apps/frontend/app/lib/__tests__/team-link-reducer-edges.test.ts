import { describe, expect, it } from 'vitest';
import {
  SEAT_TAKEN_REFUSAL_MARKER,
  type GameStatus,
  type JoinAcceptedPayload,
} from '@campus-pubquiz/types';
import {
  initialTeamLink,
  teamLink,
  type StoredIdentity,
  type TeamLinkCommand,
  type TeamLinkEntry,
  type TeamLinkInput,
  type TeamLinkState,
} from '@/app/lib/team-link';

const STORED: StoredIdentity = {
  teamName: 'The Quizzards',
  teamToken: 'token-1',
  teamCode: 'QUICK-JADE-FOX',
  gameCode: 'ABCDEF',
};

const ACCEPTED: JoinAcceptedPayload = {
  teamId: 1,
  teamName: 'The Quizzards',
  teamToken: 'token-2',
  teamCode: 'ASSIGNED-CODE',
  answers: [],
  bonusAwards: [],
  roundRatings: [],
  feedback: { comment: '', topics: [] },
  sessionRatings: { pacing: null, feltDifficulty: null },
  playerCount: null,
  joker: null,
  coins: 0,
};

const SEAT_TAKEN = `Team is ${SEAT_TAKEN_REFUSAL_MARKER}`;
const CLEAR_TIMER: TeamLinkCommand = { type: 'clearConfirmTimer' };

function run(
  start: TeamLinkState,
  ...inputs: TeamLinkInput[]
): { state: TeamLinkState; commands: TeamLinkCommand[] } {
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

function status(value: GameStatus) {
  return { type: 'statusSeen', status: value } as const;
}

function returningPhone(entry: Partial<TeamLinkEntry> = {}) {
  return initialTeamLink({ url: {}, stored: STORED, ...entry });
}

/** A phone linked to team 1 on connection 1, sitting in the lobby. */
function linkedPhone() {
  return run(
    returningPhone(),
    connected(1),
    { type: 'joinAccepted', payload: ACCEPTED },
    status('lobby'),
  );
}

const ANSWER: TeamLinkInput = {
  type: 'answerSubmitted',
  questionId: 5,
  teamId: 1,
  value: 'Paris',
};

function joinsIn(commands: TeamLinkCommand[]) {
  return commands.filter((command) => command.type === 'sendJoin');
}

describe('team link: what the form shows from storage', () => {
  it('leaves the team code field empty when a stored name has no team code', () => {
    const state = returningPhone({
      stored: { teamName: 'The Quizzards', gameCode: 'ABCDEF' },
    });

    expect(state.teamCodeInput).toBe('');
  });
});

describe('team link: submitting the join form', () => {
  it('does nothing with a name but no game code', () => {
    const { state, commands } = run(
      initialTeamLink({ url: {} }),
      { type: 'nameTyped', value: 'The Quizzards' },
      { type: 'joinSubmitted' },
    );

    expect(commands).toEqual([]);
    expect(state.attempt).toBe(0);
  });

  it('does nothing with a game code but no name', () => {
    const { state, commands } = run(
      initialTeamLink({ url: {} }),
      { type: 'gameCodeTyped', value: 'abcdef' },
      { type: 'joinSubmitted' },
    );

    expect(commands).toEqual([]);
    expect(state.attempt).toBe(0);
  });
});

describe('team link: leaving a session', () => {
  it('forgets the URL game code when kicked or when the session closes, but keeps it on logout', () => {
    const entry = { url: { gameCode: 'URLGAM' } };
    const kicked = run(returningPhone(entry), { type: 'kicked' }).state;
    const closed = run(returningPhone(entry), { type: 'sessionClosed' }).state;
    const loggedOut = run(returningPhone(entry), {
      type: 'logoutRequested',
    }).state;

    expect(kicked).toMatchObject({ codeInput: '', activeJoinCode: null });
    expect(closed).toMatchObject({ codeInput: '', activeJoinCode: null });
    expect(loggedOut).toMatchObject({
      codeInput: 'URLGAM',
      activeJoinCode: 'URLGAM',
    });
  });

  it('stops the answer confirm timer first when an answer is pending', () => {
    const pending = run(linkedPhone().state, ANSWER).state;

    const { commands } = teamLink(pending, { type: 'kicked' });

    expect(commands).toEqual([
      CLEAR_TIMER,
      { type: 'clearIdentity', scope: 'all' },
      { type: 'goToJoinScreen' },
    ]);
  });

  it('ignores a join accepted after the kick', () => {
    const kicked = run(linkedPhone().state, { type: 'kicked' }).state;

    const step = teamLink(kicked, { type: 'joinAccepted', payload: ACCEPTED });

    expect(step.state).toBe(kicked);
    expect(step.commands).toEqual([]);
  });
});

describe('team link: a status seen after joining', () => {
  it('sends no join when the status moves between two non-lobby statuses', () => {
    const { commands } = run(
      linkedPhone().state,
      status('rules'),
      status('question_open'),
    );

    expect(joinsIn(commands)).toEqual([]);
  });

  it('sends no join when the lobby is seen again', () => {
    const { commands } = run(linkedPhone().state, status('lobby'));

    expect(joinsIn(commands)).toEqual([]);
  });

  it('sends a join when the quiz restarts into the lobby', () => {
    const { commands } = run(
      linkedPhone().state,
      status('rules'),
      status('lobby'),
    );

    expect(joinsIn(commands)).toHaveLength(1);
  });
});

describe('team link: connections', () => {
  it('keeps the link, the retry count and the last status when the same connection reports again', () => {
    const refused = run(
      returningPhone(),
      connected(1),
      { type: 'joinRefused', connectionId: 1, reason: SEAT_TAKEN },
      status('rules'),
    );
    expect(refused.state.joinRetries).toBe(1);

    const again = teamLink(refused.state, connected(1)).state;

    expect(again).toMatchObject({ joinRetries: 1, lastStatus: 'rules' });
    expect(teamLink(linkedPhone().state, connected(1)).state.isLinked).toBe(
      true,
    );
  });

  it('unlinks and starts afresh on a new connection', () => {
    const phone = run(linkedPhone().state, status('rules'));

    const { state } = teamLink(phone.state, connected(2));

    expect(state).toMatchObject({
      isLinked: false,
      lastStatus: null,
      joinRetries: 0,
    });
  });

  it('resets the retry count on a new connection', () => {
    const refused = run(returningPhone(), connected(1), {
      type: 'joinRefused',
      connectionId: 1,
      reason: SEAT_TAKEN,
    });

    expect(teamLink(refused.state, connected(2)).state.joinRetries).toBe(0);
  });

  it('stops the confirm timer when a new connection replaces one with a pending answer', () => {
    const pending = run(linkedPhone().state, ANSWER).state;

    const { commands } = teamLink(pending, connected(2));

    expect(commands[0]).toEqual(CLEAR_TIMER);
  });

  it('stops the confirm timer on disconnect only when an answer is pending', () => {
    const idle = linkedPhone().state;
    const pending = run(idle, ANSWER).state;

    expect(teamLink(idle, { type: 'disconnected' }).commands).toEqual([]);
    expect(teamLink(pending, { type: 'disconnected' }).commands).toEqual([
      CLEAR_TIMER,
    ]);
  });
});

describe('team link: rejoin retries after a refusal', () => {
  it('retries a seat-taken refusal for a team that was linked, even without a stored token', () => {
    // The URL names another team, so the stored token is not used, but the
    // server did accept this phone as a team: the refusal can only be its own old socket.
    const phone = run(
      initialTeamLink({ url: { name: 'Other', gameCode: 'ABCDEF' } }),
      { type: 'joinSubmitted' },
      connected(1),
      { type: 'joinAccepted', payload: ACCEPTED },
      { type: 'storageRead', stored: STORED },
    );
    expect(phone.state.storedTeamToken).toBeUndefined();
    expect(phone.state.team).not.toBeNull();

    const { commands, state } = teamLink(phone.state, {
      type: 'joinRefused',
      connectionId: 1,
      reason: SEAT_TAKEN,
    });

    expect(commands).toEqual([
      {
        type: 'scheduleJoinRetry',
        connectionId: 1,
        delayMs: expect.any(Number),
      },
    ]);
    expect(state.joinError).toBeNull();
  });

  it('ignores a retry that was due for an earlier connection', () => {
    const phone = run(
      returningPhone(),
      connected(1),
      { type: 'joinRefused', connectionId: 1, reason: SEAT_TAKEN },
      connected(2),
      { type: 'joinRefused', connectionId: 2, reason: SEAT_TAKEN },
    );
    expect(phone.state.isJoinInFlight).toBe(false);

    const step = teamLink(phone.state, {
      type: 'joinRetryDue',
      connectionId: 1,
    });

    expect(step.commands).toEqual([]);
    expect(step.state).toBe(phone.state);
  });
});

describe('team link: the answer in flight', () => {
  it('keeps answer results of a send made before the team data was cleared from landing on a later send', () => {
    const phone = run(
      linkedPhone().state,
      ANSWER,
      { type: 'identityChanged' },
      { type: 'joinAccepted', payload: ACCEPTED },
      ANSWER,
    );
    const firstSend = 1;
    expect(phone.state.answerAttempt).not.toBe(firstSend);

    const late = teamLink(phone.state, {
      type: 'answerResult',
      attempt: firstSend,
      result: { success: true },
    });

    expect(late.state.pendingAnswer).not.toBeNull();
    expect(late.commands).toEqual([]);
  });

  it('stops the confirm timer when the team data is replaced under a pending answer, and only then', () => {
    const idle = linkedPhone().state;
    const pending = run(idle, ANSWER).state;

    expect(teamLink(idle, { type: 'identityChanged' }).commands).toEqual([]);
    expect(teamLink(pending, { type: 'identityChanged' }).commands).toEqual([
      CLEAR_TIMER,
    ]);
  });

  it('clears the pending answer and the timer when the server accepts it', () => {
    const pending = run(linkedPhone().state, ANSWER).state;

    const step = teamLink(pending, {
      type: 'answerResult',
      attempt: pending.answerAttempt,
      result: { success: true },
    });

    expect(step.state.pendingAnswer).toBeNull();
    expect(step.commands).toEqual([CLEAR_TIMER]);
  });

  it('keeps an undelivered answer pending and stops the timer, ignoring a superseded send', () => {
    const pending = run(linkedPhone().state, ANSWER).state;

    const current = teamLink(pending, {
      type: 'answerNotDelivered',
      attempt: pending.answerAttempt,
    });
    const stale = teamLink(pending, {
      type: 'answerNotDelivered',
      attempt: pending.answerAttempt - 1,
    });

    expect(current.commands).toEqual([CLEAR_TIMER]);
    expect(current.state.pendingAnswer).not.toBeNull();
    expect(stale.commands).toEqual([]);
    expect(stale.state).toBe(pending);
  });
});

describe('team link: a join accepted with the optional parts left out', () => {
  it('starts the team with no answers, awards or ratings', () => {
    const bare = {
      teamId: 1,
      teamName: 'The Quizzards',
      teamToken: 'token-2',
      teamCode: 'ASSIGNED-CODE',
    } as JoinAcceptedPayload;

    const { state } = teamLink(linkedPhone().state, {
      type: 'joinAccepted',
      payload: bare,
    });

    expect(state.myAnswers).toEqual({});
    expect(state.myAnswerGrades).toEqual({});
    expect(state.myBonusAwards).toEqual([]);
    expect(Object.keys(state.myRoundRatings)).toEqual([]);
  });
});

describe('team link: bonus award toasts', () => {
  it('celebrates points and stays neutral for a zero-point award', () => {
    const phone = linkedPhone().state;

    const scored = teamLink(phone, {
      type: 'bonusAwarded',
      payload: { category: 'shot', points: 1 },
    });
    const zero = teamLink(phone, {
      type: 'bonusAwarded',
      payload: { category: 'shot', points: 0 },
    });

    expect(scored.commands[0]).toMatchObject({ tone: 'success' });
    expect(zero.commands[0]).toMatchObject({ tone: 'neutral' });
    expect((zero.commands[0] as { message: string }).message).not.toContain(
      '🎉',
    );
  });
});

describe('team link: joker changes from the server', () => {
  function withJoker(roundId: number, source: 'chosen' | 'drawn') {
    return run(linkedPhone().state, {
      type: 'jokerSaved',
      joker: { roundId, source },
    }).state;
  }

  it('announces a drawn joker that moved to another round', () => {
    const { commands } = teamLink(withJoker(1, 'drawn'), {
      type: 'jokerSynced',
      joker: { roundId: 2, source: 'drawn' },
    });

    expect(commands).toEqual([
      expect.objectContaining({
        type: 'toast',
        message: 'A joker was drawn for your team',
      }),
    ]);
  });

  it('announces a joker whose source changed on the same round', () => {
    const { commands } = teamLink(withJoker(1, 'chosen'), {
      type: 'jokerSynced',
      joker: { roundId: 1, source: 'set_by_quiz_master' },
    });

    expect(commands).toEqual([
      expect.objectContaining({
        type: 'toast',
        message: 'Your joker was changed by the quiz master',
      }),
    ]);
  });

  it('stays quiet for the joker already held', () => {
    const { commands } = teamLink(withJoker(1, 'drawn'), {
      type: 'jokerSynced',
      joker: { roundId: 1, source: 'drawn' },
    });

    expect(commands).toEqual([]);
  });

  it('stays quiet for the team’s own pick and for a joker taken away', () => {
    const held = withJoker(1, 'drawn');

    expect(
      teamLink(held, {
        type: 'jokerSynced',
        joker: { roundId: 2, source: 'chosen' },
      }).commands,
    ).toEqual([]);
    expect(
      teamLink(held, { type: 'jokerSynced', joker: null }).commands,
    ).toEqual([]);
  });

  it('announces a drawn joker for a team that held none', () => {
    const { commands } = teamLink(linkedPhone().state, {
      type: 'jokerSynced',
      joker: { roundId: 1, source: 'drawn' },
    });

    expect(commands).toHaveLength(1);
  });
});

describe('team link: an input it does not know', () => {
  it('throws naming the input', () => {
    expect(() =>
      teamLink(linkedPhone().state, { type: 'nonsense' } as never),
    ).toThrow('Unhandled team link input: {"type":"nonsense"}');
  });
});
