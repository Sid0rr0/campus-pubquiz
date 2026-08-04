import {
  Entity,
  Enum,
  ManyToOne,
  OptionalProps,
  Property,
} from '@mikro-orm/core';
import type { BonusCategory } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { Team } from '@/db/entities/team.entity';
import { BonusAwardRepository } from '@/db/repositories/bonus-award.repository';

const BONUS_CATEGORIES: BonusCategory[] = ['shot', 'selfie', 'custom'];

@Entity({ tableName: 'bonus_awards', repository: () => BonusAwardRepository })
export class BonusAward extends BaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @ManyToOne(() => GameSession, { deleteRule: 'cascade' })
  gameSession!: GameSession;

  @ManyToOne(() => Team, { deleteRule: 'cascade' })
  team!: Team;

  @Enum({ items: () => BONUS_CATEGORIES })
  category!: BonusCategory;

  // Free-text reason: the admin's own words for a "custom" award, unused for
  // the predefined "shot"/"selfie" categories (their label is derived from
  // category on display instead).
  @Property({ type: 'text', nullable: true })
  reason?: string;

  @Property({ type: 'float' })
  points!: number;
}
