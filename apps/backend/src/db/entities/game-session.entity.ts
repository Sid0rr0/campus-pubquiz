import { Entity, ManyToOne, OptionalProps, Property } from '@mikro-orm/core';
import type { GameStatus } from '@campus-pubquiz/types';
import { BaseEntity } from '@/db/entities/base.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';

@Entity({ tableName: 'game_sessions', repository: () => GameSessionRepository })
export class GameSession extends BaseEntity {
  [OptionalProps]?:
    | 'createdAt'
    | 'updatedAt'
    | 'status'
    | 'currentRoundIndex'
    | 'currentQuestionIndex'
    | 'revealIndex'
    | 'furthestOpenIndex'
    | 'isLeaderboardVisible';

  @ManyToOne(() => Quiz, { deleteRule: 'cascade' })
  quiz!: Quiz;

  @Property({ type: 'text', unique: true })
  joinCode!: string;

  @Property({ type: 'text' })
  status: GameStatus = 'lobby';

  @Property({ default: 0 })
  currentRoundIndex: number = 0;

  @Property({ default: 0 })
  currentQuestionIndex: number = 0;

  @Property({ default: 0 })
  revealIndex: number = 0;

  @Property({ default: 0 })
  furthestOpenIndex: number = 0;

  @Property({ default: false })
  isLeaderboardVisible: boolean = false;
}
