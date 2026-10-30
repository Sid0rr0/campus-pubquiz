import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  purchaseEffectSchema,
  type PowerUpId,
  type PurchaseEffect,
  type PurchaseView,
} from '@campus-pubquiz/types';
import { Purchase } from '@/db/entities/purchase.entity';
import { PurchaseRepository } from '@/db/repositories/purchase.repository';

/** A stored purchase with the cost the team paid: the ledger row the balance and the limits are worked out from. */
export interface PurchaseRecord extends PurchaseView {
  cost: number;
}

export interface NewPurchase {
  gameSessionId: number;
  teamId: number;
  powerUp: PowerUpId;
  questionId: number | null;
  roundId: number | null;
  cost: number;
  effect: PurchaseEffect;
}

/** A team's power-up purchases in a session: one row each, the stored effect as JSON. */
@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchases: PurchaseRepository,
  ) {}

  /** Stores a purchase. The caller has checked it is allowed. */
  async add(purchase: NewPurchase): Promise<void> {
    const now = new Date();
    await this.purchases.insert({
      gameSession: purchase.gameSessionId,
      team: purchase.teamId,
      powerUp: purchase.powerUp,
      question: purchase.questionId ?? undefined,
      round: purchase.roundId ?? undefined,
      cost: purchase.cost,
      effect: purchase.effect,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** The team's purchases this session, oldest first. Read by team and session, not the roster, so a kicked team keeps its ledger. */
  async listForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<PurchaseRecord[]> {
    const rows = (await this.purchases
      .getKnex()('purchases')
      .where({ game_session_id: gameSessionId, team_id: teamId })
      .orderBy('id')
      .select(
        'power_up as powerUp',
        'question_id as questionId',
        'round_id as roundId',
        'cost',
        'effect',
      )) as (Omit<PurchaseRecord, 'effect'> & { effect: unknown })[];
    // The effect is stored JSON, so it is parsed on the way out, never cast.
    return rows.map((row) => ({
      ...row,
      effect: purchaseEffectSchema.parse(row.effect),
    }));
  }

  /** Which team bought which power-up on the question, oldest first: the answer list's "used" column and the wider-margin grading read it. */
  async listForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<{ teamId: number; powerUp: PowerUpId }[]> {
    return (await this.purchases
      .getKnex()('purchases')
      .where({ game_session_id: gameSessionId, question_id: questionId })
      .orderBy('id')
      .select('team_id as teamId', 'power_up as powerUp')) as {
      teamId: number;
      powerUp: PowerUpId;
    }[];
  }
}

/** What a team's phone is sent of its purchases: the ledger row without its cost. */
export function toPurchaseViews(
  records: readonly PurchaseRecord[],
): PurchaseView[] {
  return records.map(({ powerUp, questionId, roundId, effect }) => ({
    powerUp,
    questionId,
    roundId,
    effect,
  }));
}
