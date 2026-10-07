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
import { QuizLiveEditBlockedError } from '@/quiz/live-edit-guard';
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
        game.liveEdit,
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

describe('Re-importing onto a quiz another session is playing', () => {
  const harness = setupRealStoreGatewayTest();
  {
    const freeText = (prompt: string, points = 1) => ({
      type: 'free_text' as const,
      prompt,
      answer: `Answer to ${prompt}`,
      points,
    });
    const csvRow = (round: string, prompt: string, points = 1) =>
      `${round},free_text,${prompt},,Answer to ${prompt},${points},,,,1`;
    // The playing session has Q1 open; the importing one sits in the lobby.
    let playing: RealStoreGateway;
    let importingJoinCode: string;

    beforeEach(async () => {
      playing = await harness.createGateway({
        rounds: [
          {
            title: 'Round A',
            breakAfter: true,
            questions: [freeText('Q1', 3), freeText('Q2')],
          },
          { title: 'Round B', breakAfter: true, questions: [freeText('Q3')] },
        ],
        teamNames: ['Saturn Fans'],
      });
      await playing.connectAdmin();
      for (const action of ['START_QUIZ', 'ADVANCE', 'ADVANCE'] as const) {
        await playing.act(action); // -> rules -> round_intro(A) -> Q1 open
      }
      const created = await playing.inRequestContext(() =>
        playing.gameState.createSession(playing.quizId),
      );
      importingJoinCode = created.joinCode;
      await playing.connectAdmin(importingJoinCode);
      playing.clearEmits();
    });

    function reimport(rows: string[]) {
      return playing.inRequestContext(async () => {
        const em = RequestContext.getEntityManager()!;
        const quizzes = em.getRepository<Quiz, QuizRepository>(Quiz);
        const quizService = new QuizService(
          quizzes,
          em.getRepository<Round, RoundRepository>(Round),
          em.getRepository<Question, QuestionRepository>(Question),
        );
        const { title } = await quizzes.findOneOrFail({ id: playing.quizId });
        return new ImportService(
          quizzes,
          playing.gameState,
          quizService,
          playing.liveEdit,
        ).confirm([HEADER, ...rows].join('\n'), importingJoinCode, title);
      });
    }

    const storedPrompts = async () =>
      (
        await playing.inRequestContext(() =>
          playing.quizService.findDraftById(playing.quizId),
        )
      )?.rounds.map((round) => round.questions.map((q) => q.prompt));

    it("refuses a re-import that changes the playing session's opened part, leaving that session unchanged", async () => {
      // The open Q1 turns into a multiple-choice question.
      await expect(
        reimport([
          'Round A,multiple_choice,Q1,Yes|No,Yes,3,,,,1',
          csvRow('Round A', 'Q2'),
          csvRow('Round B', 'Q3'),
        ]),
      ).rejects.toBeInstanceOf(QuizLiveEditBlockedError);

      expect(await storedPrompts()).toEqual([['Q1', 'Q2'], ['Q3']]);
      expect((await playing.snapshot()).currentQuestion?.prompt).toBe('Q1');
    });

    it('allows a re-import that only changes the unopened part, broadcasting the reloaded quiz to both sessions', async () => {
      await reimport([
        csvRow('Round A', 'Q1', 3),
        csvRow('Round A', 'Q2 reworded'),
        csvRow('Round B', 'Q3'),
      ]);

      expect(await storedPrompts()).toEqual([['Q1', 'Q2 reworded'], ['Q3']]);
      for (const joinCode of [playing.joinCode, importingJoinCode]) {
        const snapshot = await playing.snapshot(joinCode);
        expect(snapshot.roundTitles).toEqual(['Round A', 'Round B']);
      }
      expect((await playing.snapshot()).currentQuestion?.prompt).toBe('Q1');
    });
  }
});
