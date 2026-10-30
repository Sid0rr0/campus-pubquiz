import { describe, expect, it } from 'vitest';
import {
  NOT_YOUR_TEAM_ANSWER_ERROR,
  SEAT_TAKEN_REFUSAL_MARKER,
  type JoinAcceptedPayload,
} from '@campus-pubquiz/types';
import {
  initialTeamLink,
  teamLink,
  type StoredIdentity,
  type TeamLinkCommand,
  type TeamLinkInput,
  type TeamLinkState,
} from '@/app/lib/team-link';

/**
 * Plays the Team link against a model of the server's seat rule over random
 * sequences of what flaky mobile networks do: sockets that die silently, a
 * phone that drops and reconnects, a join or its reply that never arrives, the
 * server noticing a dead socket late. Two promises hold in every sequence:
 * the phone never sends an answer from a socket the server says doesn't hold
 * the seat, and once the network settles it ends up holding the seat again
 * without a reload or a kick.
 */

const STORED: StoredIdentity = {
  teamName: 'T',
  teamToken: 'token',
  gameCode: 'ABCDEF',
};

const ACCEPTED: JoinAcceptedPayload = {
  teamId: 1,
  teamName: 'T',
  teamToken: 'token',
  teamCode: 'CODE',
  answers: [],
  bonusAwards: [],
  roundRatings: [],
  feedback: { comment: '', topics: [] },
  sessionRatings: { pacing: null, feltDifficulty: null },
  playerCount: null,
  joker: null,
  coins: 0,
};

const SEAT_TAKEN = `"T" ${SEAT_TAKEN_REFUSAL_MARKER} — ask the quiz master`;
const SEQUENCES = 3000;
const STEPS_PER_SEQUENCE = 40;
const SETTLE_STEPS = 60;

/** A small deterministic random source, so a failing sequence is replayable from its seed. */
function randomSource(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

interface JoinRequest {
  socket: string;
  connectionId: number;
  previousSocketId: string | undefined;
}

/** One phone against one server seat. */
class World {
  state: TeamLinkState = initialTeamLink({ url: {}, stored: STORED });
  seat: string | null = null;
  current: string | null = null;
  violation: string | null = null;
  readonly log: string[] = [];
  private readonly isTransportAlive = new Map<string, boolean>();
  private readonly serverLive = new Set<string>();
  private pendingJoins: JoinRequest[] = [];
  private dueRetries: number[] = [];
  private connectionCount = 0;

  constructor(private readonly random: () => number) {
    this.feed({ type: 'storageRead', stored: STORED });
  }

  feed(input: TeamLinkInput): void {
    const step = teamLink(this.state, input);
    this.state = step.state;
    step.commands.forEach((command) => this.run(command));
  }

  private run(command: TeamLinkCommand): void {
    const socket = this.current;
    if (command.type === 'sendJoin' && socket) {
      this.pendingJoins.push({
        socket,
        connectionId: command.connectionId,
        previousSocketId: command.payload.previousSocketId,
      });
    } else if (command.type === 'scheduleJoinRetry') {
      this.dueRetries.push(command.connectionId);
    } else if (command.type === 'sendAnswer' && socket) {
      this.serverReceivesAnswer(socket, command.attempt);
    } else if (command.type === 'forceReconnect') {
      this.dropFromPhone();
    }
  }

  private serverReceivesAnswer(socket: string, attempt: number): void {
    if (!this.isTransportAlive.get(socket) || !this.serverLive.has(socket)) {
      return;
    }
    if (this.seat === socket) {
      this.feed({ type: 'answerResult', attempt, result: { success: true } });
      return;
    }
    // The phone offered an answer from a socket without the seat.
    this.violation = `answer sent from ${socket} while the seat is ${String(this.seat)}`;
    this.feed({
      type: 'answerResult',
      attempt,
      result: { success: false, error: NOT_YOUR_TEAM_ANSWER_ERROR },
    });
  }

  connect(): void {
    if (this.current) return;
    this.connectionCount += 1;
    const socket = `socket-${this.connectionCount}`;
    this.current = socket;
    this.isTransportAlive.set(socket, true);
    this.serverLive.add(socket);
    this.log.push(`connect ${socket}`);
    this.feed({
      type: 'connected',
      connectionId: this.connectionCount,
      socketId: socket,
    });
  }

  dropFromPhone(): void {
    const socket = this.current;
    if (!socket) return;
    this.log.push(`phone drops ${socket}`);
    if (this.isTransportAlive.get(socket)) {
      // The close reaches the server, or is lost and the ping timeout finds it later.
      if (this.random() < 0.7) this.serverNoticesDeath(socket);
      else this.isTransportAlive.set(socket, false);
    }
    this.current = null;
    this.feed({ type: 'disconnected' });
  }

  killTransport(): void {
    if (!this.current || !this.isTransportAlive.get(this.current)) return;
    this.isTransportAlive.set(this.current, false);
    this.log.push(`transport of ${this.current} dies silently`);
  }

  serverNoticesDeadSockets(isCertain: boolean): void {
    for (const socket of [...this.serverLive]) {
      if (this.isTransportAlive.get(socket)) continue;
      if (isCertain || this.random() < 0.5) this.serverNoticesDeath(socket);
    }
  }

  private serverNoticesDeath(socket: string): void {
    this.serverLive.delete(socket);
    if (this.seat === socket) this.seat = null;
    this.log.push(`server notices ${socket} is gone`);
  }

  /** The server handles the oldest join it received; the reply may find the phone gone. */
  serverHandlesJoin(): void {
    const join = this.pendingJoins.shift();
    if (!join) return;
    if (!this.isTransportAlive.get(join.socket)) return;
    if (!this.serverLive.has(join.socket)) return;
    const holder = this.seat;
    const takenOver =
      holder && holder !== join.socket && this.serverLive.has(holder)
        ? holder
        : null;
    const isReplyDeliverable = this.current === join.socket;
    if (takenOver && join.previousSocketId !== takenOver) {
      this.log.push(`server refuses ${join.socket}`);
      if (isReplyDeliverable) {
        this.feed({
          type: 'joinRefused',
          connectionId: join.connectionId,
          reason: SEAT_TAKEN,
        });
      }
      return;
    }
    this.seat = join.socket;
    this.log.push(`server seats ${join.socket}`);
    if (takenOver) {
      this.serverLive.delete(takenOver);
      if (this.current === takenOver) {
        this.current = null;
        this.feed({ type: 'disconnected' });
      }
    }
    if (isReplyDeliverable)
      this.feed({ type: 'joinAccepted', payload: ACCEPTED });
  }

  fireRetry(): void {
    const connectionId = this.dueRetries.shift();
    if (connectionId === undefined) return;
    this.log.push(`join retry due for connection ${connectionId}`);
    this.feed({ type: 'joinRetryDue', connectionId });
  }

  submitAnswer(): void {
    this.feed({
      type: 'answerSubmitted',
      questionId: 1,
      teamId: 1,
      value: 'x',
    });
  }

  confirmTimeout(): void {
    this.feed({ type: 'answerTimedOut', attempt: this.state.answerAttempt });
  }
}

function randomSequence(seed: number): World {
  const random = randomSource(seed);
  const world = new World(random);
  const actions = [
    () => world.connect(),
    () => world.connect(),
    () => world.dropFromPhone(),
    () => world.killTransport(),
    () => world.serverNoticesDeadSockets(false),
    () => world.serverHandlesJoin(),
    () => world.serverHandlesJoin(),
    () => world.fireRetry(),
    () => world.submitAnswer(),
    () => world.confirmTimeout(),
  ];
  for (let step = 0; step < STEPS_PER_SEQUENCE && !world.violation; step += 1) {
    actions[Math.floor(random() * actions.length)]();
  }
  return world;
}

/** The network settles: the server notices every dead socket, and the phone gets a working one. */
function settle(world: World): void {
  world.serverNoticesDeadSockets(true);
  world.dropFromPhone();
  world.connect();
  for (let step = 0; step < SETTLE_STEPS && !world.state.isLinked; step += 1) {
    world.serverHandlesJoin();
    world.fireRetry();
  }
}

describe('team link: the seat across flaky connections', () => {
  it('never answers from a socket without the seat', () => {
    for (let seed = 1; seed <= SEQUENCES; seed += 1) {
      const world = randomSequence(seed);

      expect(
        world.violation,
        `seed ${seed}\n${world.log.join('\n')}`,
      ).toBeNull();
    }
  });

  it('holds the seat again once the network settles, without a reload or a kick', () => {
    for (let seed = 1; seed <= SEQUENCES; seed += 1) {
      const world = randomSequence(seed);
      settle(world);

      expect(
        world.state.isLinked,
        `seed ${seed}, seat ${String(world.seat)}\n${world.log.join('\n')}`,
      ).toBe(true);
      expect(world.seat).toBe(world.current);
    }
  });
});
