import { describe, expect, it } from 'vitest';
import type { GameStatus, JoinAcceptedPayload } from '@campus-pubquiz/types';
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
};

/** Feeds inputs in order and returns the final state with every command emitted along the way. */
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

function joinsIn(commands: TeamLinkCommand[]) {
  return commands.filter((command) => command.type === 'sendJoin');
}

function connected(connectionId: number, socketId = `socket-${connectionId}`) {
  return { type: 'connected', connectionId, socketId } as const;
}

function status(value: GameStatus) {
  return { type: 'statusSeen', status: value } as const;
}

/** A phone that arrived with a stored identity. */
function returningPhone(entry: Partial<TeamLinkEntry> = {}) {
  return initialTeamLink({ url: {}, stored: STORED, ...entry });
}

/** A phone with nothing stored whose team typed a name and game code. */
function typedPhone() {
  return run(
    initialTeamLink({ url: {} }),
    { type: 'nameTyped', value: '  The Quizzards ' },
    { type: 'gameCodeTyped', value: ' abcdef ' },
  ).state;
}

describe('team link: joining', () => {
  it('sends one join when the stored identity is known before the connection connects', () => {
    const { commands } = run(returningPhone(), connected(1));

    expect(joinsIn(commands)).toEqual([
      {
        type: 'sendJoin',
        connectionId: 1,
        payload: {
          teamName: 'The Quizzards',
          teamToken: 'token-1',
          teamCode: 'QUICK-JADE-FOX',
          joinCode: 'ABCDEF',
          previousSocketId: undefined,
        },
      },
    ]);
  });

  it('sends one join when the connection connects before the stored identity is read', () => {
    const { commands } = run(
      initialTeamLink({ url: {} }),
      connected(1),
      { type: 'storageRead', stored: STORED },
      connected(1),
    );

    expect(joinsIn(commands)).toHaveLength(1);
  });

  it('sends nothing while the identity is unknown', () => {
    const { commands } = run(
      initialTeamLink({ url: { gameCode: 'ABCDEF' } }),
      connected(1),
    );

    expect(commands).toEqual([]);
  });

  it('ignores a second submit while a join is in flight', () => {
    const first = run(typedPhone(), { type: 'joinSubmitted' });

    const second = teamLink(first.state, { type: 'joinSubmitted' });

    expect(second.commands).toEqual([]);
    expect(second.state).toBe(first.state);
  });

  it('opens one fresh connection and stores the name and game code on submit', () => {
    const { commands, state } = run(typedPhone(), { type: 'joinSubmitted' });

    expect(commands).toEqual([
      {
        type: 'writeIdentity',
        identity: { teamName: 'The Quizzards', gameCode: 'ABCDEF' },
      },
    ]);
    expect(state).toMatchObject({ activeJoinCode: 'ABCDEF', attempt: 1 });
  });

  it('does nothing on submit without a name or game code', () => {
    const { commands, state } = run(initialTeamLink({ url: {} }), {
      type: 'joinSubmitted',
    });

    expect(commands).toEqual([]);
    expect(state.attempt).toBe(0);
  });

  it('sends a typed join once, even though submit and the connect both land', () => {
    const { commands } = run(
      typedPhone(),
      { type: 'joinSubmitted' },
      connected(1),
      connected(1),
    );

    expect(joinsIn(commands)).toHaveLength(1);
  });

  it('shows a refused join, releases the guard and sends a fresh join over a fresh connection on the next submit', () => {
    const refused = run(typedPhone(), { type: 'joinSubmitted' }, connected(1), {
      type: 'joinRefused',
      connectionId: 1,
      reason: 'Wrong team code',
    });
    expect(refused.state.joinError).toBe('Wrong team code');

    const retry = run(refused.state, { type: 'joinSubmitted' }, connected(2));

    expect(retry.state.joinError).toBeNull();
    expect(retry.state).toMatchObject({ activeJoinCode: 'ABCDEF', attempt: 2 });
    expect(joinsIn(retry.commands)).toHaveLength(1);
  });

  it('clears the error once a later join is accepted', () => {
    const { state } = run(
      returningPhone(),
      connected(1),
      { type: 'joinRefused', connectionId: 1, reason: 'Wrong team code' },
      connected(2),
      { type: 'joinAccepted', payload: ACCEPTED },
    );

    expect(state.joinError).toBeNull();
  });

  it('ignores a refusal that answers a join on an earlier connection', () => {
    const { state } = run(returningPhone(), connected(1), connected(2), {
      type: 'joinRefused',
      connectionId: 1,
      reason: 'not connected',
    });

    expect(state.joinError).toBeNull();
  });

  it('lets the next submit through after the connection was refused', () => {
    const { state } = run(
      typedPhone(),
      { type: 'joinSubmitted' },
      { type: 'connectionRefused' },
      { type: 'joinSubmitted' },
    );

    expect(state.attempt).toBe(2);
  });

  it('mirrors the assigned team code into the form and stores it with the token', () => {
    const { state, commands } = run(typedPhone(), {
      type: 'joinAccepted',
      payload: ACCEPTED,
    });

    expect(state.teamCodeInput).toBe('ASSIGNED-CODE');
    expect(commands).toEqual([
      {
        type: 'writeIdentity',
        identity: { teamToken: 'token-2', teamCode: 'ASSIGNED-CODE' },
      },
    ]);
  });
});

describe('team link: reconnecting', () => {
  it('rejoins on a new connection, naming the socket the team was linked on', () => {
    const { commands } = run(
      returningPhone(),
      connected(1, 'socket-a'),
      { type: 'joinAccepted', payload: ACCEPTED },
      { type: 'disconnected' },
      connected(2, 'socket-b'),
    );

    const joins = joinsIn(commands);
    expect(joins).toHaveLength(2);
    expect(joins[1]).toMatchObject({
      connectionId: 2,
      payload: { previousSocketId: 'socket-a' },
    });
  });

  it('names no earlier socket when the rejoin is on the same socket', () => {
    const { commands } = run(
      returningPhone(),
      connected(1, 'socket-a'),
      { type: 'joinAccepted', payload: ACCEPTED },
      { type: 'disconnected' },
      connected(2, 'socket-a'),
    );

    expect(joinsIn(commands)[1]).toMatchObject({
      payload: { previousSocketId: undefined },
    });
  });

  it('uses the typed team code over the stored one, and the stored one when none is typed', () => {
    const typed = run(
      returningPhone(),
      { type: 'teamCodeTyped', value: ' TYPED-CODE ' },
      connected(1),
    );
    expect(joinsIn(typed.commands)[0]).toMatchObject({
      payload: { teamCode: 'TYPED-CODE' },
    });

    const blank = run(
      returningPhone(),
      { type: 'teamCodeTyped', value: '   ' },
      connected(1),
    );
    expect(joinsIn(blank.commands)[0]).toMatchObject({
      payload: { teamCode: 'QUICK-JADE-FOX' },
    });
  });
});

describe('team link: session restart', () => {
  it('sends one join when the status moves into the lobby from another status', () => {
    const { commands } = run(
      returningPhone(),
      connected(1),
      { type: 'joinAccepted', payload: ACCEPTED },
      status('question_open'),
      status('lobby'),
    );

    expect(joinsIn(commands)).toHaveLength(2);
  });

  it('sends no extra join when the first status seen on a connection is the lobby', () => {
    const { commands } = run(returningPhone(), connected(1), status('lobby'));

    expect(joinsIn(commands)).toHaveLength(1);
  });

  it('sends no extra join for a restart while a join is in flight', () => {
    const { commands } = run(
      returningPhone(),
      connected(1),
      status('question_open'),
      status('lobby'),
    );

    expect(joinsIn(commands)).toHaveLength(1);
  });

  it('treats the first status on a fresh connection as a first status again', () => {
    const { commands } = run(
      typedPhone(),
      { type: 'joinSubmitted' },
      connected(1),
      status('question_open'),
      { type: 'joinAccepted', payload: ACCEPTED },
      { type: 'joinSubmitted' },
      connected(2),
      status('lobby'),
    );

    expect(joinsIn(commands)).toHaveLength(2);
  });
});

describe('team link: a reconnect and the first status', () => {
  it("sends no extra join when a new connection's first status is the lobby after another status on the old one", () => {
    const { commands } = run(
      returningPhone(),
      connected(1),
      { type: 'joinAccepted', payload: ACCEPTED },
      status('question_open'),
      { type: 'disconnected' },
      connected(2),
      { type: 'joinAccepted', payload: ACCEPTED },
      status('lobby'),
    );

    expect(joinsIn(commands)).toHaveLength(2);
  });

  it('still sends a join for a restart on the same connection after a reconnect', () => {
    const { commands } = run(
      returningPhone(),
      connected(1),
      status('question_open'),
      { type: 'disconnected' },
      connected(2),
      { type: 'joinAccepted', payload: ACCEPTED },
      status('question_open'),
      status('lobby'),
    );

    expect(joinsIn(commands)).toHaveLength(3);
  });
});

describe('team link: entry precedence', () => {
  it('lets the URL win over what the phone stored', () => {
    const state = returningPhone({
      url: { gameCode: 'URLGAME', teamCode: 'URL-CODE', name: 'URL Team' },
    });

    expect(state).toMatchObject({
      nameInput: 'URL Team',
      codeInput: 'URLGAME',
      teamCodeInput: 'URL-CODE',
      activeJoinCode: 'URLGAME',
    });
  });

  it('fills only what the URL left empty from storage', () => {
    const state = returningPhone({ url: { name: 'URL Team' } });

    expect(state).toMatchObject({
      nameInput: 'URL Team',
      codeInput: 'ABCDEF',
      teamCodeInput: 'QUICK-JADE-FOX',
      activeJoinCode: 'ABCDEF',
      teamName: 'URL Team',
    });
  });

  it("joins as the URL's name and team code, not the stored ones", () => {
    const { commands } = run(
      returningPhone({ url: { name: 'URL Team', teamCode: 'URL-CODE' } }),
      connected(1),
    );

    expect(joinsIn(commands)[0]).toMatchObject({
      payload: { teamName: 'URL Team', teamCode: 'URL-CODE' },
    });
  });

  it.each([
    ['team code', { teamCode: 'URL-CODE' }],
    ['name', { name: 'URL Team' }],
    ['game code', { gameCode: 'URLGAM' }],
  ])(
    'does not send the stored token when the URL gives a different %s',
    (_, url) => {
      const { commands } = run(returningPhone({ url }), connected(1));

      expect(joinsIn(commands)[0]).toMatchObject({
        payload: { teamToken: undefined },
      });
    },
  );

  it('keeps the stored token when the URL agrees with what is stored', () => {
    const { commands } = run(
      returningPhone({
        url: {
          name: 'The Quizzards',
          teamCode: 'QUICK-JADE-FOX',
          gameCode: 'ABCDEF',
        },
      }),
      connected(1),
    );

    expect(joinsIn(commands)[0]).toMatchObject({
      payload: { teamToken: 'token-1' },
    });
  });

  it('shows the form, not a connecting screen, when the name survived but the game code did not', () => {
    const state = returningPhone({
      stored: { teamName: 'The Quizzards', teamCode: 'QUICK-JADE-FOX' },
    });

    expect(state.activeJoinCode).toBeNull();
  });

  it('reports a stored token so the form offers log out', () => {
    expect(returningPhone().hasStoredIdentity).toBe(true);
    expect(initialTeamLink({ url: {} }).hasStoredIdentity).toBe(false);
  });
});

const KICK_NOTICE = 'You were removed from this team by the quiz master';

/** A phone linked to team 1 on connection 1. */
function linkedPhone() {
  return run(
    returningPhone(),
    connected(1),
    { type: 'joinAccepted', payload: ACCEPTED },
    status('lobby'),
  );
}

function expectNextSubmitLetThrough(state: TeamLinkState) {
  const next = run(
    state,
    { type: 'nameTyped', value: 'Another Team' },
    { type: 'gameCodeTyped', value: 'zzzzzz' },
    { type: 'joinSubmitted' },
  ).state;
  expect(next).toMatchObject({
    activeJoinCode: 'ZZZZZZ',
    attempt: state.attempt + 1,
  });
}

describe('team link: being kicked', () => {
  it('clears all storage, empties the form, shows the notice and goes to the join screen', () => {
    const { state, commands } = run(linkedPhone().state, { type: 'kicked' });

    expect(commands).toEqual([
      { type: 'clearIdentity', scope: 'all' },
      { type: 'goToJoinScreen' },
    ]);
    expect(state).toMatchObject({
      teamName: null,
      nameInput: '',
      teamCodeInput: '',
      codeInput: '',
      activeJoinCode: null,
      hasStoredIdentity: false,
      kickNotice: KICK_NOTICE,
    });
  });

  it('sends no further join when kicked while a join is in flight', () => {
    const { state, commands } = run(
      returningPhone(),
      connected(1),
      { type: 'kicked' },
      connected(2),
      { type: 'joinRefused', connectionId: 1, reason: 'late' },
    );

    expect(joinsIn(commands)).toHaveLength(1);
    expect(state.isJoinInFlight).toBe(false);
    expect(state.joinError).toBeNull();
    expect(commands).toContainEqual({ type: 'clearIdentity', scope: 'all' });
  });

  it('holds when the page mounts already kicked, even if storage is read afterwards', () => {
    const { state, commands } = run(
      initialTeamLink({ url: {} }),
      { type: 'kicked' },
      { type: 'storageRead', stored: STORED },
      connected(1),
    );

    expect(joinsIn(commands)).toEqual([]);
    expect(state).toMatchObject({
      teamName: null,
      nameInput: '',
      kickNotice: KICK_NOTICE,
    });
  });

  it('lets the next submit through and drops the notice', () => {
    const kicked = run(linkedPhone().state, { type: 'kicked' }).state;

    expectNextSubmitLetThrough(kicked);
    const submitted = run(
      kicked,
      { type: 'nameTyped', value: 'Again' },
      { type: 'gameCodeTyped', value: 'abcdef' },
      { type: 'joinSubmitted' },
    ).state;
    expect(submitted.kickNotice).toBeNull();
  });
});

describe('team link: the session closing', () => {
  it('clears the session part of storage, keeps name and team code, and goes to the join screen', () => {
    const { state, commands } = run(
      returningPhone(),
      connected(1),
      { type: 'joinRefused', connectionId: 1, reason: 'nope' },
      { type: 'sessionClosed' },
    );

    expect(commands.slice(-2)).toEqual([
      { type: 'clearIdentity', scope: 'session' },
      { type: 'goToJoinScreen' },
    ]);
    expect(state).toMatchObject({
      teamName: null,
      activeJoinCode: null,
      codeInput: '',
      joinError: null,
      isJoinInFlight: false,
      hasStoredIdentity: false,
      nameInput: 'The Quizzards',
      teamCodeInput: 'QUICK-JADE-FOX',
      kickNotice: null,
    });
  });

  it('sends no join on a later connection', () => {
    const { commands } = run(
      returningPhone(),
      { type: 'sessionClosed' },
      connected(1),
    );

    expect(joinsIn(commands)).toEqual([]);
  });

  it('lets the next submit through', () => {
    const closed = run(returningPhone(), connected(1), {
      type: 'sessionClosed',
    }).state;

    expectNextSubmitLetThrough(closed);
  });
});

describe('team link: logging out', () => {
  it('sends the leave before clearing storage when a team is confirmed', () => {
    const { state, commands } = run(linkedPhone().state, {
      type: 'logoutRequested',
    });

    expect(commands).toEqual([
      { type: 'sendLeave', teamId: ACCEPTED.teamId },
      { type: 'clearIdentity', scope: 'session' },
    ]);
    expect(state).toMatchObject({
      teamName: null,
      nameInput: 'The Quizzards',
      teamCodeInput: 'ASSIGNED-CODE',
      isJoinInFlight: false,
      joinError: null,
      hasStoredIdentity: false,
    });
  });

  it('resets the game code to the one in the URL', () => {
    const { state } = run(
      returningPhone({ url: { gameCode: 'URLGAM' } }),
      connected(1),
      { type: 'joinAccepted', payload: ACCEPTED },
      { type: 'logoutRequested' },
    );

    expect(state).toMatchObject({
      codeInput: 'URLGAM',
      activeJoinCode: 'URLGAM',
    });
  });

  it('sends no leave when no team is confirmed', () => {
    const { commands } = run(returningPhone(), connected(1), {
      type: 'logoutRequested',
    });

    expect(commands.map((command) => command.type)).toEqual([
      'sendJoin',
      'clearIdentity',
    ]);
  });

  it('sends only one leave when logging out twice', () => {
    const { commands } = run(
      linkedPhone().state,
      { type: 'logoutRequested' },
      { type: 'logoutRequested' },
    );

    expect(commands.filter((c) => c.type === 'sendLeave')).toHaveLength(1);
  });

  it('lets the next submit through', () => {
    const { state } = run(linkedPhone().state, { type: 'logoutRequested' });

    expectNextSubmitLetThrough(state);
  });
});
