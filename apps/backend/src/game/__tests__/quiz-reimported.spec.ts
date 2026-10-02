import { RequestContext } from '@mikro-orm/postgresql';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { Quiz } from '@/db/entities/quiz.entity';
import { Round } from '@/db/entities/round.entity';
import type { QuestionRepository } from '@/db/repositories/question.repository';
import type { QuizRepository } from '@/db/repositories/quiz.repository';
import type { RoundRepository } from '@/db/repositories/round.repository';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';
import { ImportService } from '@/import/import.service';
import { QuizService } from '@/quiz/quiz.service';

const HEADER =
  'round,type,question,options,answer,points,media_url,answer_media_url,notes,break_after';

const REIMPORTED_CSV = [
  HEADER,
  'Picture Round,free_text,Largest planet?,,Jupiter,2,,,,1',
].join('\n');

describe('Re-importing the quiz behind a session', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway();
    await game.connectAdmin();
    game.clearEmits();
  });

  // ImportController.confirm runs inside an HTTP request context.
  function reimportActiveQuiz(csvText: string) {
    return game.inRequestContext(async () => {
      const em = RequestContext.getEntityManager()!;
      const quizzes = em.getRepository<Quiz, QuizRepository>(Quiz);
      const quizService = new QuizService(
        quizzes,
        em.getRepository<Round, RoundRepository>(Round),
        em.getRepository<Question, QuestionRepository>(Question),
      );
      const { title } = await quizzes.findOneOrFail({ id: game.quizId });
      return new ImportService(
        quizzes,
        game.gameState,
        quizService,
        game.gateway,
      ).confirm(csvText, game.joinCode, title);
    });
  }

  it('broadcasts the re-imported rounds to every room, so the lobby screens show them without a press', async () => {
    await reimportActiveQuiz(REIMPORTED_CSV);

    for (const room of [SOCKET_ROOMS.ADMIN, SOCKET_ROOMS.DISPLAY]) {
      const snapshots = game.payloadsTo<StateSnapshotPayload>(
        room,
        SOCKET_EVENTS.STATE_UPDATED,
      );
      expect(snapshots.at(-1)?.roundTitles).toEqual(['Picture Round']);
    }
  });
});
