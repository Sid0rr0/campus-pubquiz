import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { generateJoinCode } from '@/db/join-code.util';
import { HARDCODED_QUIZ } from '@/game/hardcoded-quiz.fixture';
import type {
  CreatedGameSession,
  SeededGame,
  SeededRound,
} from '@/db/seed.types';

interface QuestionPayload {
  options?: string[];
  matchTargets?: string[];
  mediaUrl?: string;
  answerMediaUrl?: string;
  mediaStartSeconds?: number;
  mediaEndSeconds?: number;
}

// Picks only the player-safe payload fields: imported questions also carry
// the correct answer in their payload, which must never reach a QuestionView
// (snapshots go to every connected phone and the big screen).
function toViewPayload(payload: unknown): QuestionPayload {
  const {
    options,
    matchTargets,
    mediaUrl,
    answerMediaUrl,
    mediaStartSeconds,
    mediaEndSeconds,
  } = payload as QuestionPayload;
  return {
    ...(options !== undefined ? { options } : {}),
    ...(matchTargets !== undefined ? { matchTargets } : {}),
    ...(mediaUrl !== undefined ? { mediaUrl } : {}),
    ...(answerMediaUrl !== undefined ? { answerMediaUrl } : {}),
    ...(mediaStartSeconds !== undefined ? { mediaStartSeconds } : {}),
    ...(mediaEndSeconds !== undefined ? { mediaEndSeconds } : {}),
  };
}

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Quiz) private readonly quizzes: QuizRepository,
    @InjectRepository(Round) private readonly rounds: RoundRepository,
    @InjectRepository(Question)
    private readonly questions: QuestionRepository,
    @InjectRepository(GameSession)
    private readonly gameSessions: GameSessionRepository,
  ) {}

  async seed(): Promise<SeededGame> {
    const [existingSession] = await this.gameSessions.find(
      {},
      { orderBy: { createdAt: 'desc' }, limit: 1 },
    );
    if (existingSession) {
      return this.loadGame(
        existingSession.quiz.id,
        existingSession.id,
        existingSession.joinCode,
      );
    }
    return this.createSeededGame();
  }

  async createSession(quizId: number): Promise<CreatedGameSession> {
    const session = this.gameSessions.create({
      quiz: quizId,
      joinCode: generateJoinCode(),
    });
    await this.gameSessions.getEntityManager().persistAndFlush(session);
    return { gameSessionId: session.id, joinCode: session.joinCode };
  }

  async loadGame(
    quizId: number,
    gameSessionId: number,
    joinCode: string,
  ): Promise<SeededGame> {
    const roundRows = await this.rounds.find(
      { quiz: quizId },
      { orderBy: { orderIndex: 'asc' } },
    );

    const rounds: SeededRound[] = [];
    for (const roundRow of roundRows) {
      const questionRows = await this.questions.find(
        { round: roundRow.id },
        { orderBy: { orderIndex: 'asc' } },
      );

      rounds.push({
        id: roundRow.id,
        title: roundRow.title,
        breakAfter: roundRow.breakAfter,
        questions: questionRows.map((row) => ({
          id: row.id,
          type: row.type,
          prompt: row.prompt,
          points: row.points,
          answer: row.answer,
          ...toViewPayload(row.payload),
        })),
      });
    }

    return { quizId, gameSessionId, joinCode, rounds };
  }

  private async createSeededGame(): Promise<SeededGame> {
    const quiz = this.quizzes.create({ title: HARDCODED_QUIZ.title });
    await this.quizzes.getEntityManager().persistAndFlush(quiz);

    const rounds: SeededRound[] = [];
    for (const [roundIndex, round] of HARDCODED_QUIZ.rounds.entries()) {
      const roundRow = this.rounds.create({
        quiz,
        title: round.title,
        orderIndex: roundIndex,
        breakAfter: round.breakAfter,
      });
      await this.rounds.getEntityManager().persistAndFlush(roundRow);

      const questions: SeededRound['questions'] = [];
      for (const [questionIndex, question] of round.questions.entries()) {
        const questionRow = this.questions.create({
          round: roundRow,
          orderIndex: questionIndex,
          type: question.type,
          prompt: question.prompt,
          answer: question.answer,
          payload: {
            options: question.options,
            matchTargets: question.matchTargets,
            mediaUrl: question.mediaUrl,
            answerMediaUrl: question.answerMediaUrl,
          },
          points: question.points,
        });
        await this.questions.getEntityManager().persistAndFlush(questionRow);

        questions.push({
          id: questionRow.id,
          type: questionRow.type,
          prompt: questionRow.prompt,
          points: questionRow.points,
          answer: questionRow.answer,
          ...toViewPayload(questionRow.payload),
        });
      }

      rounds.push({
        id: roundRow.id,
        title: roundRow.title,
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
