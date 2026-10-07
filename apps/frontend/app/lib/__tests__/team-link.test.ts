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

  it('opens one connection and stores the name and game code on submit', () => {
    const { commands } = run(typedPhone(), { type: 'joinSubmitted' });

    expect(commands).toEqual([
      {
        type: 'writeIdentity',
        identity: { teamName: 'The Quizzards', gameCode: 'ABCDEF' },
      },
      { type: 'openConnection', gameCode: 'ABCDEF', attempt: 1 },
    ]);
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
    expect(retry.commands).toContainEqual({
      type: 'openConnection',
      gameCode: 'ABCDEF',
      attempt: 2,
    });
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
    const { commands } = run(
      typedPhone(),
      { type: 'joinSubmitted' },
      { type: 'connectionRefused' },
      { type: 'joinSubmitted' },
    );

    expect(commands.filter((c) => c.type === 'openConnection')).toHaveLength(2);
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
      teamName: 'The Quizzards',
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

describe('team link: leaving a session', () => {
  it('releases the guard, clears the error and forgets the token', () => {
    const { state, commands } = run(
      returningPhone(),
      connected(1),
      { type: 'joinRefused', connectionId: 1, reason: 'nope' },
      { type: 'identityReset', clearAll: false, gameCode: '' },
    );

    expect(state).toMatchObject({
      teamName: null,
      activeJoinCode: null,
      joinError: null,
      isJoinInFlight: false,
      hasStoredIdentity: false,
      nameInput: 'The Quizzards',
      teamCodeInput: 'QUICK-JADE-FOX',
    });
    expect(commands).toContainEqual({
      type: 'clearIdentity',
      scope: 'session',
    });
  });

  it('empties the form when everything is cleared', () => {
    const { state, commands } = run(returningPhone(), {
      type: 'identityReset',
      clearAll: true,
      gameCode: '',
    });

    expect(state).toMatchObject({ nameInput: '', teamCodeInput: '' });
    expect(commands).toEqual([{ type: 'clearIdentity', scope: 'all' }]);
  });

  it('sends no join on a later connection once the identity is gone', () => {
    const { commands } = run(
      returningPhone(),
      { type: 'identityReset', clearAll: true, gameCode: '' },
      connected(1),
    );

    expect(joinsIn(commands)).toEqual([]);
  });
});
