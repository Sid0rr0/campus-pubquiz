/**
 * Compile-time assertions that a socket event declaration's Zod schema and
 * its protocol payload stay in step. Not a Jest suite: `pnpm typecheck`
 * compiles it, and a lost `@ts-expect-error` (or a new error) fails the build.
 */
import { z } from 'zod';
import { SOCKET_EVENTS, SOCKET_ROOMS } from '@campus-pubquiz/types';
import { adminActionPayloadSchema } from '@/game/socket/socket-payload.schemas';
import { declareSocketEvent } from '@/game/socket/socket-event-declarations';

const base = {
  allowedRoom: SOCKET_ROOMS.ADMIN,
  rejection: 'nope',
  logFields: [],
} as const;

// A schema matching the protocol payload is accepted.
declareSocketEvent({
  ...base,
  event: SOCKET_EVENTS.ADMIN_ACTION,
  schema: adminActionPayloadSchema,
});

// A schema that loses a field its payload has is rejected.
declareSocketEvent({
  ...base,
  event: SOCKET_EVENTS.GRADE_ANSWER,
  // @ts-expect-error the schema lacks `pointsAwarded`
  schema: z.object({ answerId: z.number() }),
});

// A schema that gains a field its payload doesn't have is rejected.
declareSocketEvent({
  ...base,
  event: SOCKET_EVENTS.ADMIN_ACTION,
  // @ts-expect-error the schema has an extra `extra` field
  schema: adminActionPayloadSchema.extend({ extra: z.string() }),
});
