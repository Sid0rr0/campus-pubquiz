import type { Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import { sessionRoom, type AckResult } from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { acknowledge } from '@/game/socket/acknowledge.util';
import { deliverOutcome } from '@/game/socket/outcome-delivery.util';
import type { SocketEventDeclaration } from '@/game/socket/socket-event-declarations';
import { parseSocketPayload } from '@/game/socket/socket-payload.schemas';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import type { GameStateService } from '@/game/state/game-state.service';
import type { SessionOutcome } from '@/game/state/session-outcome';

/** What an event body receives: the session it was sent to, its parsed payload, and who sent it. */
export interface EventContext<P> {
  joinCode: string;
  payload: P;
  client: Socket;
}

/**
 * What an event body hands back for delivery. `afterDelivery` is for
 * socket-level work that must follow the emits (re-arming timers); it runs
 * even if delivery fails, since the event was already applied by then.
 */
export type EventResult =
  | SessionOutcome
  | { outcome: SessionOutcome; afterDelivery: () => void }
  | undefined;

export interface DispatchDeps {
  gameState: GameStateService;
  answerService: AnswerService;
  server: Server;
  logger: Logger;
}

function isAfterDelivery(
  result: Exclude<EventResult, undefined>,
): result is { outcome: SessionOutcome; afterDelivery: () => void } {
  return 'afterDelivery' in result;
}

function resolveJoinCode(client: Socket): string {
  const joinCode = (client.data as { joinCode?: string }).joinCode;
  if (!joinCode) {
    throw new WsException('Connection not associated with a game session');
  }
  return joinCode;
}

function logAccepted<S extends z.ZodType>(
  logger: Logger,
  client: Socket,
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
 * rejection precedence never varies: validate the payload, find the
 * session, check the sender's room, log, run the body, deliver its outcome.
 * The module's refusals become socket errors here, and only here.
 * A plain function rather than a Nest guard/pipe so specs calling the
 * gateway's handler methods directly exercise the same checks as production.
 */
export async function dispatchSocketEvent<S extends z.ZodType>(
  deps: DispatchDeps,
  client: Socket,
  declaration: SocketEventDeclaration<S>,
  rawPayload: unknown,
  body: (context: EventContext<z.infer<S>>) => Promise<EventResult>,
): Promise<AckResult> {
  return acknowledge(client, deps.logger, declaration.event, async () => {
    const payload = parseSocketPayload(declaration.schema, rawPayload);
    const joinCode = resolveJoinCode(client);
    if (!client.rooms.has(sessionRoom(joinCode, declaration.allowedRoom))) {
      throw new WsException(declaration.rejection);
    }
    logAccepted(deps.logger, client, declaration, payload);

    const result = await body({ joinCode, payload, client }).catch(
      (error: unknown) => {
        if (error instanceof SessionRefusal) {
          throw new WsException(error.message);
        }
        throw error;
      },
    );
    if (!result) return;
    const { outcome, afterDelivery } = isAfterDelivery(result)
      ? result
      : { outcome: result, afterDelivery: undefined };
    try {
      await deliverOutcome(deps, joinCode, outcome, client);
    } finally {
      afterDelivery?.();
    }
  });
}
