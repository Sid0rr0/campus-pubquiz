import type { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { GameSocket } from '@/game/socket/game-socket.types';
import type { z } from 'zod';
import { sessionRoom, type AckResult } from '@campus-pubquiz/types';
import { acknowledge } from '@/game/socket/acknowledge.util';
import { countEventAgainstLimit } from '@/game/socket/event-rate-limit.util';
import type { DeliverFn } from '@/game/socket/outcome-delivery.util';
import type { SocketEventDeclaration } from '@/game/socket/socket-event-declarations';
import { parseSocketPayload } from '@/game/socket/socket-payload.schemas';
import type { LiveChangeModules } from '@/game/state/live-change-modules';
import type { SessionWrite } from '@/game/state/session-write';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { SessionOutcome } from '@/game/state/session-outcome';

/** What an event body receives: the session it was sent to, its parsed payload, and who sent it. */
export interface EventContext<P> {
  joinCode: string;
  payload: P;
  client: GameSocket;
}

/** What an event body hands back for delivery: its outcome, or nothing when it is only acknowledged. */
export type EventResult = SessionOutcome | undefined;

/** The body of an event whose declaration names its change: that change, run through the session write. */
function declaredChange<S extends z.ZodType>(
  deps: DispatchDeps,
  declaration: SocketEventDeclaration<S>,
): (context: EventContext<z.infer<S>>) => Promise<EventResult> {
  const { change } = declaration;
  if (!change) {
    throw new Error(`${declaration.event} declares no change and has no body`);
  }
  return ({ joinCode, payload, client }) =>
    deps.sessionWrite.write(joinCode, (session) =>
      change(deps.changes, session, payload, client.id),
    );
}

export interface DispatchDeps {
  logger: Logger;
  sessionWrite: SessionWrite;
  changes: LiveChangeModules;
  /** The Session broadcaster's delivery step. */
  deliver: DeliverFn;
}

function resolveJoinCode(client: GameSocket): string {
  const joinCode = client.data.joinCode;
  if (!joinCode) {
    throw new WsException('Connection not associated with a game session');
  }
  return joinCode;
}

function logAccepted<S extends z.ZodType>(
  logger: Logger,
  client: GameSocket,
  declaration: SocketEventDeclaration<S>,
  payload: z.infer<S>,
): void {
  const fields = declaration.logFields
    .map((field) => `${field}=${String(payload[field])}`)
    .join(' ');
  logger.log(`${declaration.event} from ${client.id}: ${fields}`);
}

/**
 * The template every client-to-server event shares, in one fixed order so
 * rejection precedence never varies: count the event against the
 * connection's rate limit, validate the payload, find the
 * session, check the sender's room, log, run the body, deliver its outcome.
 * The module's refusals become socket errors here, and only here.
 * A plain function rather than a Nest guard/pipe so specs calling the
 * gateway's handler methods directly exercise the same checks as production.
 */
export async function dispatchSocketEvent<S extends z.ZodType>(
  deps: DispatchDeps,
  client: GameSocket,
  declaration: SocketEventDeclaration<S>,
  rawPayload: unknown,
  body?: (context: EventContext<z.infer<S>>) => Promise<EventResult>,
): Promise<AckResult> {
  return acknowledge(client, deps.logger, declaration.event, async () => {
    countEventAgainstLimit(client);
    const payload = parseSocketPayload(declaration.schema, rawPayload);
    const joinCode = resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, declaration.allowedRoom))) {
      throw new WsException(declaration.rejection);
    }
    logAccepted(deps.logger, client, declaration, payload);

    const run = body ?? declaredChange(deps, declaration);
    const result = await run({ joinCode, payload, client }).catch(
      (error: unknown) => {
        if (error instanceof SessionRefusal) {
          throw new WsException(error.message);
        }
        // The fallback applies only to declared changes, not to inline bodies.
        if (body === undefined && declaration.fallbackRefusal !== undefined) {
          throw new WsException(
            error instanceof Error
              ? error.message
              : declaration.fallbackRefusal,
          );
        }
        throw error;
      },
    );
    if (!result) return;
    await deps.deliver(joinCode, result, client);
  });
}
