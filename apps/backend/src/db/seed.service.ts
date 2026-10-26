import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  DEFAULT_SESSION_SETTINGS,
  questionNotesOf,
  rowToSeededQuestion,
  type SeededGame,
  type SeededRound,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { GameSession } from '@/db/entities/game-session.entity';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import { GameSessionRepository } from '@/db/repositories/game-session.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { QuizRepository } from '@/db/repositories/quiz.repository';
import { RoundRepository } from '@/db/repositories/round.repository';
import { readQuestionPayload } from '@/db/question-payload';
import { generateJoinCode } from '@/db/join-code.util';
import { HARDCODED_QUIZ } from '@/game/fixtures/hardcoded-quiz.fixture';
import type { CreatedGameSession } from '@/db/seed.types';

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

  /** Every session an admin has not closed, oldest first; the demo game on an empty database. */
  async seedOpenGames(): Promise<SeededGame[]> {
    const open = await this.gameSessions.find(
      { closedAt: null },
      { orderBy: { createdAt: 'asc' } },
    );
    if (open.length === 0) {
      return (await this.gameSessions.count()) === 0 ? [await this.seed()] : [];
    }
    const games: SeededGame[] = [];
    for (const row of open) {
      games.push(await this.loadGame(row.quiz.id, row.id, row.joinCode));
    }
    return games;
  }

  /** Marks a session closed so it is not reloaded on the next boot. */
  async markClosed(gameSessionId: number): Promise<void> {
    await this.gameSessions.nativeUpdate(
      { id: gameSessionId },
      { closedAt: new Date() },
    );
  }

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

  async createSession(
    quizId: number,
    settings: SessionSettings = DEFAULT_SESSION_SETTINGS,
    name?: string,
  ): Promise<CreatedGameSession> {
    const session = this.gameSessions.create({
      quiz: quizId,
      joinCode: generateJoinCode(),
      settings,
      name: name?.trim() || null,
    });
    await this.gameSessions.getEntityManager().persistAndFlush(session);
    return { gameSessionId: session.id, joinCode: session.joinCode };
  }

  /** Merges the given settings into an existing session's row — the lobby-settings-update flow's persistence step. */
  async updateSettings(
    gameSessionId: number,
    settings: SessionSettings,
  ): Promise<void> {
    const gameSessionRow = await this.gameSessions.findOneOrFail(gameSessionId);
    gameSessionRow.settings = settings;
    await this.gameSessions.getEntityManager().persistAndFlush(gameSessionRow);
  }

  async loadGame(
    quizId: number,
    gameSessionId: number,
    joinCode: string,
  ): Promise<SeededGame> {
    const gameSessionRow = await this.gameSessions.findOneOrFail(gameSessionId);
    const quiz = await this.quizzes.findOneOrFail(quizId);
    const rounds = await this.loadQuizRounds(quizId);

    return {
      quizId,
      gameSessionId,
      joinCode,
      quizTitle: quiz.title,
      customName: gameSessionRow.name,
      startedAt: gameSessionRow.createdAt,
      rounds,
      // Sessions stored before the "Collect feedback" / "Fun facts" settings have no such field: they count as on.
      settings: {
        ...gameSessionRow.settings,
        collectFeedback: gameSessionRow.settings.collectFeedback ?? true,
        funFactsEnabled: gameSessionRow.settings.funFactsEnabled ?? true,
        // ...and before the "Jokers" setting, jokers are off.
        jokersEnabled: gameSessionRow.settings.jokersEnabled ?? false,
      },
    };
  }

  /** A quiz's rounds as a session's seeded game holds them — read-only and needing no session row, so a quiz preview and a session can't hold the quiz differently. */
  async loadQuizRounds(quizId: number): Promise<SeededRound[]> {
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
        kahootMode: roundRow.kahootMode,
        category: roundRow.category ?? undefined,
        author: roundRow.author ?? undefined,
        note: roundRow.note ?? undefined,
        showNoteOnScreen: roundRow.showNoteOnScreen,
        questions: questionRows.map((row) =>
          rowToSeededQuestion(row, readQuestionPayload(row)),
        ),
        questionNotesById: Object.fromEntries(
          questionRows.map((row) => [row.id, questionNotesOf(row.notes)]),
        ),
      });
    }

    return rounds;
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

        questions.push(
          rowToSeededQuestion(questionRow, readQuestionPayload(questionRow)),
        );
      }

      rounds.push({
        id: roundRow.id,
        title: roundRow.title,
        breakAfter: roundRow.breakAfter,
        kahootMode: roundRow.kahootMode,
        showNoteOnScreen: roundRow.showNoteOnScreen,
        questions,
        // The hardcoded fixture carries no notes — matches what a subsequent
        // loadGame() would read back (Question.notes defaults to null),
        // so seed()'s result stays identical whether it just created this
        // game or is resuming an already-seeded one.
        questionNotesById: Object.fromEntries(
          questions.map((question) => [question.id, null]),
        ),
      });
    }

    const session = await this.createSession(quiz.id);
    const sessionRow = await this.gameSessions.findOneOrFail(
      session.gameSessionId,
    );

    return {
      quizId: quiz.id,
      gameSessionId: session.gameSessionId,
      joinCode: session.joinCode,
      quizTitle: quiz.title,
      customName: sessionRow.name,
      startedAt: sessionRow.createdAt,
      rounds,
      settings: DEFAULT_SESSION_SETTINGS,
    };
  }
}
