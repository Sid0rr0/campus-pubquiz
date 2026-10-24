import {
  freshSessionState,
  LOBBY_PROGRESS,
  type ScoredQuestion,
  type SeededGame,
} from '@campus-pubquiz/types';
import type { AnswerService } from '@/answer/answer.service';
import { BlockGradingService } from '@/game/state/block-grading.service';

function stubAnswerService() {
  return {
    regradeForKeyFix: jest.fn(),
    listForQuestion: jest.fn().mockResolvedValue([]),
    listUngradedQuestionIds: jest.fn().mockResolvedValue([]),
  };
}

function question(id: number, type: string, answer: string): ScoredQuestion {
  return { id, type, answer, points: 1 } as unknown as ScoredQuestion;
}

function seeded(questions: ScoredQuestion[]): SeededGame {
  return {
    gameSessionId: 1,
    settings: { kahootQuestionTimerSeconds: 10 },
    rounds: [{ title: 'Round', questions, kahootMode: false }],
  } as unknown as SeededGame;
}

describe('BlockGradingService.gradesChanged', () => {
  it('asks only about changed questions that are in the block in play', async () => {
    const answerService = stubAnswerService();
    answerService.listUngradedQuestionIds.mockResolvedValue([1]);
    const grading = new BlockGradingService(
      answerService as unknown as AnswerService,
    );
    const seededGame = {
      gameSessionId: 1,
      settings: { kahootQuestionTimerSeconds: 10 },
      rounds: [
        {
          title: 'Now',
          breakAfter: true,
          questions: [question(1, 'free_text', 'Queen')],
        },
        {
          title: 'Later',
          breakAfter: true,
          questions: [question(2, 'free_text', 'Abba')],
        },
      ],
    } as unknown as SeededGame;
    const session = {
      ...freshSessionState(seededGame, {
        ...LOBBY_PROGRESS,
        status: 'question_open',
        furthestOpenIndex: 0,
      }),
      ungradedQuestionIds: [2],
    };

    const result = await grading.gradesChanged(session, [1, 2]);

    expect(answerService.listUngradedQuestionIds).toHaveBeenCalledWith(1, [1]);
    expect(result.ungradedQuestionIds).toEqual([2, 1]);
  });
});

describe('BlockGradingService.regradeForKeyFix', () => {
  it('hands back the reloaded session untouched, with nothing re-scored and no answering teams, when no question needs a regrade', async () => {
    const answerService = stubAnswerService();
    const grading = new BlockGradingService(
      answerService as unknown as AnswerService,
    );
    const seededGame = seeded([]);
    const reloaded = freshSessionState(seededGame);

    const result = await grading.regradeForKeyFix(
      reloaded,
      freshSessionState(seededGame),
      [42],
    );

    expect(result.session).toBe(reloaded);
    expect(result.regradedQuestionIds).toEqual([]);
    expect(result.answeringTeamIds).toEqual(new Set());
    expect(answerService.listForQuestion).not.toHaveBeenCalled();
    expect(answerService.listUngradedQuestionIds).not.toHaveBeenCalled();
  });

  describe('with a closest_guess question that has had its batch, one that has not, and one that was not corrected', () => {
    const batched = question(1, 'closest_guess', '650');
    const notBatched = question(2, 'closest_guess', '650');
    const untouched = question(3, 'free_text', 'Queen');
    const answers = [
      { teamName: 'Near', value: '480' },
      { teamName: 'Far', value: '650' },
    ];
    const staleSummary = { hasSubmissions: false, closestGuesses: [] };
    const otherSummary = {
      hasSubmissions: true,
      minGuess: '1',
      maxGuess: '2',
      closestGuesses: [{ teamName: 'Kept', value: '2' }],
    };

    async function regrade() {
      const answerService = stubAnswerService();
      answerService.regradeForKeyFix.mockResolvedValue({
        rescored: true,
        answers,
      });
      const grading = new BlockGradingService(
        answerService as unknown as AnswerService,
      );
      const seededGame = seeded([batched, notBatched, untouched]);
      const reloaded = {
        ...freshSessionState(seededGame),
        closestGuessSummaries: { 1: staleSummary, 9: otherSummary },
      };
      const result = await grading.regradeForKeyFix(
        reloaded,
        freshSessionState(seededGame),
        [1, 2],
      );
      return { result, answerService };
    }

    it('re-scores only the corrected questions', async () => {
      const { result, answerService } = await regrade();

      expect(answerService.regradeForKeyFix).toHaveBeenCalledTimes(2);
      expect(answerService.regradeForKeyFix).toHaveBeenNthCalledWith(
        1,
        1,
        batched,
        batched,
        null,
        true,
      );
      expect(answerService.regradeForKeyFix).toHaveBeenNthCalledWith(
        2,
        1,
        notBatched,
        notBatched,
        null,
        false,
      );
      expect(result.regradedQuestionIds).toEqual([1, 2]);
    });

    it('leaves out a question the answer module did not re-score: not listed, its summary kept as it was', async () => {
      const answerService = stubAnswerService();
      answerService.regradeForKeyFix.mockResolvedValue({
        rescored: false,
        answers,
      });
      const grading = new BlockGradingService(
        answerService as unknown as AnswerService,
      );
      const seededGame = seeded([batched]);
      const reloaded = {
        ...freshSessionState(seededGame),
        closestGuessSummaries: { 1: staleSummary },
      };

      const result = await grading.regradeForKeyFix(
        reloaded,
        freshSessionState(seededGame),
        [1],
      );

      expect(result.regradedQuestionIds).toEqual([]);
      expect(result.session).toBe(reloaded);
      expect(result.session.closestGuessSummaries).toEqual({ 1: staleSummary });
    });

    it('recomputes the summary of a question whose batch ran, keeps the others, and adds none for a question that has no batch yet', async () => {
      const { result } = await regrade();

      expect(result.session.closestGuessSummaries).toEqual({
        1: {
          hasSubmissions: true,
          minGuess: '480',
          maxGuess: '650',
          closestGuesses: [{ teamName: 'Far', value: '650' }],
        },
        9: otherSummary,
      });
    });
  });
});
