import type { QuizDraft } from '@campus-pubquiz/types';
import type { GameGateway } from '@/game/game.gateway';
import { LiveEditService } from '@/game/live-edit/live-edit.service';
import type { GameStateService } from '@/game/state/game-state.service';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';
import type { QuizService } from '@/quiz/quiz.service';

const DRAFT: QuizDraft = { id: 1, title: 'Quiz', rounds: [] };
const SAVE_REQUEST = { title: 'Quiz', rounds: [] };

function sessionOn(joinCode: string) {
  return {
    seededGame: { joinCode, rounds: [] },
    openedQuestionIds: [],
    progress: { status: 'question', roundIndex: 0 },
  };
}

/** Two live sessions; the second one's quiz edit fails after the first one's has landed. */
function makeService(deliver: jest.Mock) {
  const sessions = [sessionOn('AAAAAA'), sessionOn('BBBBBB')];
  const saveFailure = new Error('second reload failed');
  const gameState = {
    listLiveSessions: () => sessions,
    holdQuizSessions: (
      _quizId: number,
      task: (held: unknown) => Promise<unknown>,
    ) =>
      task({
        applyQuizEdit: (joinCode: string) =>
          joinCode === 'BBBBBB'
            ? Promise.reject(saveFailure)
            : Promise.resolve(BROADCAST_STATE_OUTCOME),
      }),
  };
  const quizService = {
    findDraftById: () => Promise.resolve(DRAFT),
    update: () =>
      Promise.resolve({ quizId: 1, roundCount: 0, questionCount: 0 }),
  };
  const service = new LiveEditService(
    quizService as unknown as QuizService,
    gameState as unknown as GameStateService,
    { deliverSessionOutcome: deliver } as unknown as GameGateway,
  );
  return { service, saveFailure };
}

describe('LiveEditService — a failing delivery', () => {
  it('does not mask the error that failed the save', async () => {
    const deliver = jest.fn().mockRejectedValue(new Error('socket down'));
    const { service, saveFailure } = makeService(deliver);

    await expect(service.save(1, SAVE_REQUEST)).rejects.toBe(saveFailure);

    expect(deliver).toHaveBeenCalledWith('AAAAAA', BROADCAST_STATE_OUTCOME);
  });
});
