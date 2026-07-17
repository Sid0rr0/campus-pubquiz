import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { QuestionType } from '@campus-pubquiz/types';
import { DRIZZLE } from '@/db/db.constants';
import { generateJoinCode } from '@/db/join-code.util';
import { HARDCODED_QUIZ } from '@/game/hardcoded-quiz.fixture';
import * as schema from '@/db/schema';
import type {
  CreatedGameSession,
  SeededGame,
  SeededRound,
} from '@/db/seed.types';

interface QuestionPayload {
  options?: string[];
  mediaUrl?: string;
}

@Injectable()
export class SeedService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async seed(): Promise<SeededGame> {
    const [existingSession] = await this.db
      .select()
      .from(schema.gameSessions)
      .orderBy(desc(schema.gameSessions.createdAt))
      .limit(1);
    if (existingSession) {
      return this.loadGame(
        existingSession.quizId,
        existingSession.id,
        existingSession.joinCode,
      );
    }
    return this.createSeededGame();
  }

  async createSession(quizId: string): Promise<CreatedGameSession> {
    const [session] = await this.db
      .insert(schema.gameSessions)
      .values({ quizId, joinCode: generateJoinCode() })
      .returning();
    return { gameSessionId: session.id, joinCode: session.joinCode };
  }

  async loadGame(
    quizId: string,
    gameSessionId: string,
    joinCode: string,
  ): Promise<SeededGame> {
    const roundRows = await this.db
      .select()
      .from(schema.rounds)
      .where(eq(schema.rounds.quizId, quizId))
      .orderBy(schema.rounds.orderIndex);

    const rounds: SeededRound[] = [];
    for (const roundRow of roundRows) {
      const questionRows = await this.db
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.roundId, roundRow.id))
        .orderBy(schema.questions.orderIndex);

      rounds.push({
        id: roundRow.id,
        breakAfter: roundRow.breakAfter,
        questions: questionRows.map((row) => ({
          id: row.id,
          type: row.type as QuestionType,
          prompt: row.prompt,
          points: row.points,
          ...(row.payload as QuestionPayload),
        })),
      });
    }

    return { quizId, gameSessionId, joinCode, rounds };
  }

  private async createSeededGame(): Promise<SeededGame> {
    const [quiz] = await this.db
      .insert(schema.quizzes)
      .values({ title: HARDCODED_QUIZ.title })
      .returning();

    const rounds: SeededRound[] = [];
    for (const [roundIndex, round] of HARDCODED_QUIZ.rounds.entries()) {
      const [roundRow] = await this.db
        .insert(schema.rounds)
        .values({
          quizId: quiz.id,
          title: round.title,
          orderIndex: roundIndex,
          breakAfter: round.breakAfter,
        })
        .returning();

      const questions: SeededRound['questions'] = [];
      for (const [questionIndex, question] of round.questions.entries()) {
        const [questionRow] = await this.db
          .insert(schema.questions)
          .values({
            roundId: roundRow.id,
            orderIndex: questionIndex,
            type: question.type,
            prompt: question.prompt,
            payload: { options: question.options, mediaUrl: question.mediaUrl },
            points: question.points,
          })
          .returning();

        questions.push({
          id: questionRow.id,
          type: questionRow.type as QuestionType,
          prompt: questionRow.prompt,
          points: questionRow.points,
          ...(questionRow.payload as QuestionPayload),
        });
      }

      rounds.push({
        id: roundRow.id,
        breakAfter: roundRow.breakAfter,
        questions,
      });
    }

    const session = await this.createSession(quiz.id);

    return {
      quizId: quiz.id,
      gameSessionId: session.gameSessionId,
      joinCode: session.joinCode,
      rounds,
    };
  }
}
