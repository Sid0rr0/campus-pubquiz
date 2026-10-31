import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Answer } from '@/db/entities/answer.entity';
import { BonusAward } from '@/db/entities/bonus-award.entity';
import { CoinAward } from '@/db/entities/coin-award.entity';
import { GameSession } from '@/db/entities/game-session.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { League } from '@/db/entities/league.entity';
import { LeagueSession } from '@/db/entities/league-session.entity';
import { Purchase } from '@/db/entities/purchase.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { RoundRating } from '@/db/entities/round-rating.entity';
import { SessionFeedback } from '@/db/entities/session-feedback.entity';
import { SessionPlayerCount } from '@/db/entities/session-player-count.entity';
import { SessionCarriedCoin } from '@/db/entities/session-carried-coin.entity';
import { SessionTeamJoker } from '@/db/entities/session-team-joker.entity';
import { Session } from '@/db/entities/session.entity';
import { ShowdownRound } from '@/db/entities/showdown-round.entity';
import { ShowdownRoundTeam } from '@/db/entities/showdown-round-team.entity';
import { Team } from '@/db/entities/team.entity';
import { User } from '@/db/entities/user.entity';
import config from '@/mikro-orm.config';

/** Every entity the app registers repositories for. */
export const DB_ENTITIES = [
  Quiz,
  Round,
  Question,
  GameSession,
  Team,
  GameSessionTeam,
  Answer,
  BonusAward,
  CoinAward,
  RoundRating,
  SessionFeedback,
  SessionPlayerCount,
  SessionTeamJoker,
  SessionCarriedCoin,
  Purchase,
  League,
  LeagueSession,
  User,
  Session,
  ShowdownRound,
  ShowdownRoundTeam,
];

@Global()
@Module({
  imports: [
    MikroOrmModule.forRoot(config),
    MikroOrmModule.forFeature(DB_ENTITIES),
  ],
  exports: [MikroOrmModule],
})
export class DbModule {}
