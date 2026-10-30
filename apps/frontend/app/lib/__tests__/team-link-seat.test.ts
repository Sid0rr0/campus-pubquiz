import { describe, expect, it } from 'vitest';
import {
  NOT_YOUR_TEAM_ANSWER_ERROR,
  SEAT_TAKEN_REFUSAL_MARKER,
  type JoinAcceptedPayload,
} from '@campus-pubquiz/types';
import {
  initialTeamLink,
  JOIN_RETRY_DELAY_MS,
  MAX_JOIN_RETRIES,
  teamLink,
  type StoredIdentity,
  type TeamLinkCommand,
  type TeamLinkInput,
  type TeamLinkState,
} from '@/app/lib/team-link';

/**
 * The phone's side of the one-device-per-team rule: a rejoin that the server
 * refuses because a socket it can't name still holds the team's seat, and an
 * answer the server refuses because the sending socket doesn't hold it.
 */

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
  hasCarriedCoin: false,
  purchases: [],
};

const SEAT_TAKEN = `"The Quizzards" ${SEAT_TAKEN_REFUSAL_MARKER} — ask the quiz master to remove it, then try again.`;

function run(start: TeamLinkState, ...inputs: TeamLinkInput[]) {
  let state = start;
  const commands: TeamLinkCommand[] = [];
  for (const input of inputs) {
    const step = teamLink(state, input);
    state = step.state;
    commands.push(...step.commands);
  }
  return { state, commands };
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

function connected(connectionId: number, socketId = `socket-${connectionId}`) {
  return { type: 'connected', connectionId, socketId } as const;
}

const accepted = { type: 'joinAccepted', payload: ACCEPTED } as const;

function seatRefused(connectionId: number) {
  return { type: 'joinRefused', connectionId, reason: SEAT_TAKEN } as const;
}

/** A phone that was linked on socket-1 and has since reconnected on socket-2. */
function reconnectedPhone() {
  return run(
    initialTeamLink({ url: {}, stored: STORED }),
    connected(1),
    accepted,
    { type: 'disconnected' },
    connected(2),
  );
}

describe('team link: a rejoin refused because another socket holds the seat', () => {
  it('does not show the refusal and tries again shortly on the same connection', () => {
    const { state, commands } = run(reconnectedPhone().state, seatRefused(2));

    expect(state.joinError).toBeNull();
    expect(state.isLinked).toBe(false);
    expect(ofType(commands, 'scheduleJoinRetry')).toEqual([
      {
        type: 'scheduleJoinRetry',
        connectionId: 2,
        delayMs: JOIN_RETRY_DELAY_MS,
      },
    ]);
  });

  it('sends the retry on the connection it was scheduled for, naming the earlier socket again', () => {
    const { state, commands } = run(reconnectedPhone().state, seatRefused(2), {
      type: 'joinRetryDue',
      connectionId: 2,
    });

    expect(ofType(commands, 'sendJoin')).toMatchObject([
      { connectionId: 2, payload: { previousSocketId: 'socket-1' } },
    ]);
    expect(state.isJoinInFlight).toBe(true);
  });

  it('links the phone once a retry is accepted', () => {
    const { state } = run(
      reconnectedPhone().state,
      seatRefused(2),
      { type: 'joinRetryDue', connectionId: 2 },
      accepted,
    );

    expect(state).toMatchObject({ isLinked: true, joinError: null });
  });

  it('retries after a reload too, when the phone only has its stored token', () => {
    const { commands } = run(
      initialTeamLink({ url: {}, stored: STORED }),
      connected(1),
      seatRefused(1),
    );

    expect(ofType(commands, 'scheduleJoinRetry')).toHaveLength(1);
  });

  it('shows the refusal at once to a second phone that has no token for the team', () => {
    const { state, commands } = run(
      initialTeamLink({ url: { gameCode: 'ABCDEF', name: 'The Quizzards' } }),
      {
        type: 'storageRead',
        stored: { teamName: 'The Quizzards', gameCode: 'ABCDEF' },
      },
      connected(1),
      seatRefused(1),
    );

    expect(state.joinError).toBe(SEAT_TAKEN);
    expect(ofType(commands, 'scheduleJoinRetry')).toEqual([]);
  });

  it('shows other refusals at once', () => {
    const { state, commands } = run(reconnectedPhone().state, {
      type: 'joinRefused',
      connectionId: 2,
      reason: 'Wrong team code',
    });

    expect(state.joinError).toBe('Wrong team code');
    expect(ofType(commands, 'scheduleJoinRetry')).toEqual([]);
  });

  it('gives up and shows the refusal after the retries run out', () => {
    let step = run(reconnectedPhone().state, seatRefused(2));
    for (let retry = 0; retry < MAX_JOIN_RETRIES; retry += 1) {
      step = run(
        step.state,
        { type: 'joinRetryDue', connectionId: 2 },
        seatRefused(2),
      );
    }

    expect(step.state.joinError).toBe(SEAT_TAKEN);
  });

  it('ignores a retry that is due for an earlier connection', () => {
    const { commands } = run(
      reconnectedPhone().state,
      seatRefused(2),
      { type: 'disconnected' },
      connected(3),
      { type: 'joinRetryDue', connectionId: 2 },
    );

    expect(ofType(commands, 'sendJoin')).toHaveLength(1);
  });

  it('ignores a retry once the phone is linked again', () => {
    const { commands } = run(
      reconnectedPhone().state,
      seatRefused(2),
      { type: 'joinRetryDue', connectionId: 2 },
      accepted,
      { type: 'joinRetryDue', connectionId: 2 },
    );

    expect(ofType(commands, 'sendJoin')).toHaveLength(1);
  });
});

describe('team link: an answer refused because the socket does not hold the seat', () => {
  function linkedWithAnswerSent() {
    return run(
      initialTeamLink({ url: {}, stored: STORED }),
      connected(1),
      accepted,
      {
        type: 'answerSubmitted',
        questionId: 7,
        teamId: 1,
        value: 'Paris',
      },
    );
  }

  const refusal = {
    type: 'answerResult',
    attempt: 1,
    result: { success: false, error: NOT_YOUR_TEAM_ANSWER_ERROR },
  } as const;

  it('unlinks the phone and rejoins by itself instead of showing the refusal', () => {
    const { state, commands } = run(linkedWithAnswerSent().state, refusal);

    expect(state.isLinked).toBe(false);
    expect(ofType(commands, 'toast')).toEqual([]);
    expect(ofType(commands, 'sendJoin')).toMatchObject([{ connectionId: 1 }]);
  });

  it('keeps the answer and sends it again once the rejoin is accepted', () => {
    const { state, commands } = run(
      linkedWithAnswerSent().state,
      refusal,
      accepted,
    );

    expect(state.isLinked).toBe(true);
    expect(ofType(commands, 'sendAnswer')).toMatchObject([
      { payload: { questionId: 7, value: 'Paris' } },
    ]);
  });

  it('shows the server reason and drops the answer when the resend is refused, e.g. the block locked meanwhile', () => {
    const { state, commands } = run(
      linkedWithAnswerSent().state,
      refusal,
      accepted,
      {
        type: 'answerResult',
        attempt: 2,
        result: { success: false, error: 'Answers are locked' },
      },
    );

    expect(state.pendingAnswer).toBeNull();
    expect(ofType(commands, 'toast')).toMatchObject([
      { tone: 'error', message: 'Answers are locked' },
    ]);
  });

  it('sends no second join while one is already in flight', () => {
    const restarting = run(
      linkedWithAnswerSent().state,
      { type: 'statusSeen', status: 'question_open' },
      { type: 'statusSeen', status: 'lobby' },
    );
    expect(restarting.state.isJoinInFlight).toBe(true);

    const { commands } = run(restarting.state, refusal);

    expect(ofType(commands, 'sendJoin')).toEqual([]);
  });
});
