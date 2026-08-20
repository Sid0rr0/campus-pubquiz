import { Entity, ManyToOne, OptionalProps, Property } from '@mikro-orm/core';
import {
  DEFAULT_SESSION_SETTINGS,
  type GameStatus,
  type SessionSettings,
} from '@campus-pubquiz/types';
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
    | 'isLeaderboardVisible'
    | 'settings';

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

  @Property({ default: -1 })
  furthestOpenIndex: number = -1;

  @Property({ default: false })
  isLeaderboardVisible: boolean = false;

  @Property({ type: 'json' })
  settings: SessionSettings = DEFAULT_SESSION_SETTINGS;
}
