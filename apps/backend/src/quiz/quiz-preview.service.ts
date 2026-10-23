import { Injectable } from '@nestjs/common';
import {
  buildQuizPreview,
  type QuizPreviewMode,
  type QuizPreviewOptions,
  type QuizPreviewPayload,
} from '@campus-pubquiz/types';
import { SeedService } from '@/db/seed.service';
import { QuizNotFoundError, QuizService } from '@/quiz/quiz.service';

/** The Quiz preview of a saved quiz: a read, with no session row, no in-memory session and nothing written. */
@Injectable()
export class QuizPreviewService {
  constructor(
    private readonly quizService: QuizService,
    private readonly seedService: SeedService,
  ) {}

  /** @throws QuizNotFoundError when the quiz does not exist. */
  async preview(
    quizId: number,
    mode: QuizPreviewMode,
    options: QuizPreviewOptions = {},
  ): Promise<QuizPreviewPayload> {
    if (!(await this.quizService.exists(quizId))) {
      throw new QuizNotFoundError(quizId);
    }
    const rounds = await this.seedService.loadQuizRounds(quizId);
    return buildQuizPreview(rounds, mode, options);
  }
}
