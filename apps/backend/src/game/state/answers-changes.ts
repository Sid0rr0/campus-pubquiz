import {
  isQuestionOpenForAnswering,
  SOCKET_EVENTS,
  type SessionState,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import { AnswerService } from '@/answer/answer.service';
import type { BlockGradingService } from '@/game/state/block-grading.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import { withAnsweredTeamIds } from '@/game/state/session-updates.util';

/**
 * The answers change module: builds the changes for a team submitting an
 * answer and the quiz master grading one by hand. Composed inside the game
 * state class, which hands each builder to the Session write module. It holds
 * neither, so a change can't run a write or call another event.
 */
export class AnswersChanges {
  constructor(
    private readonly answerService: AnswerService,
    private readonly grading: BlockGradingService,
  ) {}

  /**
   * A team's answer arrived from `socketId`. Refuses it when the question is
   * no longer open or the socket doesn't own the team's seat (both checked
   * before the answer is stored); otherwise measures the kahoot response time
   * from the phase start, stores the answer, runs the answer refresh and
   * replies "answer received" to the sender.
   */
  async submit(
    session: SessionState,
    { teamId, questionId, value }: SubmitAnswerPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    if (!isQuestionOpenForAnswering(session, questionId)) {
      throw new SessionRefusal('Answers are locked for this question');
    }
    if (session.connectedTeamSockets[teamId] !== socketId) {
      throw new SessionRefusal('You may only submit answers for your own team');
    }

    const responseMs =
      session.phaseStartedAt === null
        ? null
        : Date.now() - session.phaseStartedAt;
    const submitted = await this.answerService.submit(
      session.seededGame.gameSessionId,
      questionId,
      teamId,
      value,
      responseMs,
    );

    const refreshed = await this.refreshAnswers(session, questionId);
    return {
      session: refreshed.session,
      outcome: {
        ...refreshed.outcome,
        replies: [
          {
            event: SOCKET_EVENTS.ANSWER_RECEIVED,
            payload: {
              questionId,
              teamId: submitted.teamId,
              teamName: submitted.teamName,
              value: submitted.value,
              pointsAwarded: submitted.pointsAwarded,
              gradedAt: submitted.gradedAt,
              verdict: submitted.verdict,
            },
          },
        ],
      },
    };
  }

  /**
   * An admin grades an answer by hand. Refuses what the answer service
   * refuses (an unknown answer, a closest_guess answer); otherwise runs the
   * answer refresh for the answer's question.
   */
  async grade(
    session: SessionState,
    answerId: number,
    pointsAwarded: number,
  ): Promise<SessionChange<SessionOutcome>> {
    let questionId: number;
    try {
      ({ questionId } = await this.answerService.grade(
        session.seededGame.gameSessionId,
        answerId,
        pointsAwarded,
      ));
    } catch (error) {
      throw new SessionRefusal(
        error instanceof Error ? error.message : 'Unable to grade answer',
      );
    }
    return await this.refreshAnswers(session, questionId);
  }

  /**
   * The change after an answer was stored or graded: the question's
   * answered-team ids and grading refresh, and the question named for a fresh
   * admin answer list. The only path either event takes to the Grading refresh.
   */
  private async refreshAnswers(
    started: SessionState,
    questionId: number,
  ): Promise<SessionChange<SessionOutcome>> {
    const [answers, graded] = await Promise.all([
      this.answerService.listForQuestion(
        started.seededGame.gameSessionId,
        questionId,
      ),
      this.grading.gradesChanged(started, [questionId]),
    ]);
    return {
      session: withAnsweredTeamIds(
        graded,
        questionId,
        answers.map((answer) => answer.teamId),
      ),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        answerListQuestionIds: [questionId],
      },
    };
  }
}
