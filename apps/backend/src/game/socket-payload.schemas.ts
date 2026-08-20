import { z } from 'zod';
import { WsException } from '@nestjs/websockets';
import {
  BONUS_CATEGORIES,
  type BonusCategory,
  type GameAction,
} from '@campus-pubquiz/types';

// Every @SubscribeMessage handler in game.gateway.ts validates its raw,
// client-controlled payload against one of these before touching game
// state — mirrors the Zod validation already used for CSV import
// (question-row.schema.ts). Without this, a hand-crafted socket.io-client
// (not just the real frontend) could send an unbounded answer string, a
// non-finite points value, or a wrong-shaped payload straight into the DB.

const GAME_ACTIONS: readonly GameAction[] = [
  'START_QUIZ',
  'ADVANCE',
  'PREVIOUS',
  'END_QUIZ',
  'TOGGLE_LEADERBOARD',
  'REVEAL_NEXT_TEAM',
];

const ANSWER_VALUE_MAX_LENGTH = 2000;
const TEAM_NAME_MAX_LENGTH = 100;
const JOIN_CREDENTIAL_MAX_LENGTH = 100;
const BONUS_REASON_MAX_LENGTH = 500;

const positiveInt = z.number().int().positive();
const finiteNumber = z.number().finite();

export const adminActionPayloadSchema = z.object({
  action: z.enum(GAME_ACTIONS as [GameAction, ...GameAction[]]),
});

export const joinPlayersPayloadSchema = z.object({
  teamName: z.string().min(1).max(TEAM_NAME_MAX_LENGTH),
  teamToken: z.string().min(1).max(JOIN_CREDENTIAL_MAX_LENGTH).optional(),
  teamCode: z.string().min(1).max(JOIN_CREDENTIAL_MAX_LENGTH).optional(),
  joinCode: z.string().min(1).max(JOIN_CREDENTIAL_MAX_LENGTH).optional(),
});

export const submitAnswerPayloadSchema = z.object({
  questionId: positiveInt,
  teamId: positiveInt,
  value: z.string().max(ANSWER_VALUE_MAX_LENGTH),
});

export const gradeAnswerPayloadSchema = z.object({
  answerId: positiveInt,
  pointsAwarded: finiteNumber,
});

export const kickTeamPayloadSchema = z.object({
  teamId: positiveInt,
});

export const awardBonusPayloadSchema = z.object({
  teamId: positiveInt,
  category: z.enum(BONUS_CATEGORIES as [BonusCategory, ...BonusCategory[]]),
  reason: z.string().max(BONUS_REASON_MAX_LENGTH).optional(),
  points: finiteNumber,
});

/** Parses a raw socket payload against `schema`, or throws a client-safe WsException. */
export function parseSocketPayload<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.');
    throw new WsException(
      field ? `Invalid ${field}: ${issue.message}` : 'Invalid payload',
    );
  }
  return result.data;
}
