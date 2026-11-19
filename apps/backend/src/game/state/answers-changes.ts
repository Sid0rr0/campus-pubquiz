import {
  findQuestionOpenForAnswering,
  NOT_YOUR_TEAM_ANSWER_ERROR,
  SOCKET_EVENTS,
  type SessionState,
  type SubmitAnswerPayload,
} from '@campus-pubquiz/types';
import { NotFoundError } from '@mikro-orm/core';
import {
  AnswerGradeRefusedError,
  AnswerLockedError,
  AnswerService,
} from '@/answer/answer.service';
import type { BlockGradingService } from '@/game/state/block-grading.service';
import { SessionRefusal } from '@/game/state/errors/session-refusal.error';
import {
  BROADCAST_STATE_OUTCOME,
  type SessionOutcome,
} from '@/game/state/session-outcome';
import type { SessionChange } from '@/game/state/session-write';
import {
  requireSeat,
  withAnsweredTeamIds,
} from '@/game/state/session-updates.util';

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
   * before the answer is stored); otherwise measures the quickfire response time
   * from the phase start, stores the answer, runs the answer refresh and
   * replies "answer received" to the sender.
   */
  async submit(
    session: SessionState,
    { teamId, questionId, value }: SubmitAnswerPayload,
    socketId: string,
  ): Promise<SessionChange<SessionOutcome>> {
    const question = findQuestionOpenForAnswering(session, questionId);
    if (question === undefined) {
      throw new SessionRefusal('Answers are locked for this question');
    }
    requireSeat(session, socketId, NOT_YOUR_TEAM_ANSWER_ERROR, teamId);

    const responseMs =
      session.phaseStartedAt === null
        ? null
        : Date.now() - session.phaseStartedAt;
    let submitted: Awaited<ReturnType<AnswerService['submit']>>;
    try {
      submitted = await this.answerService.submit(
        session.seededGame.gameSessionId,
        question,
        teamId,
        value,
        responseMs,
        session.highestClueShown[questionId] ?? null,
      );
    } catch (error) {
      if (error instanceof AnswerLockedError) {
        throw new SessionRefusal(error.message);
      }
      throw error;
    }

    const refreshed = await this.refreshAnswers(session, questionId, teamId);
    return {
      session: refreshed.session,
      touchedScores: refreshed.touchedScores,
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
              clue: submitted.clue,
              clueValue: submitted.clueValue,
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
    const { gameSessionId, rounds } = session.seededGame;
    let questionId: number;
    try {
      questionId = await this.answerService.questionIdOf(
        gameSessionId,
        answerId,
      );
      const question = rounds
        .flatMap((round) => round.questions)
        .find(({ id }) => id === questionId);
      if (question === undefined) {
        throw new SessionRefusal(
          'This answer is not to a question in the session',
        );
      }
      await this.answerService.grade(
        gameSessionId,
        answerId,
        question,
        pointsAwarded,
      );
    } catch (error) {
      // Only the answer module's own refusals reach the quiz master; anything
      // else (a lost database connection) is logged and answered generically.
      if (
        error instanceof AnswerGradeRefusedError ||
        error instanceof NotFoundError
      ) {
        throw new SessionRefusal(error.message);
      }
      throw error;
    }
    return await this.refreshAnswers(session, questionId, null);
  }

  /**
   * The change after an answer was stored or graded: the question's
   * answered-team ids and grading refresh, and the question named for a fresh
   * admin answer list. The only path either event takes to the Grading refresh.
   */
  private async refreshAnswers(
    started: SessionState,
    questionId: number,
    submitterTeamId: number | null,
  ): Promise<SessionChange<SessionOutcome>> {
    const [answers, graded] = await Promise.all([
      this.answerService.listForQuestion(
        started.seededGame.gameSessionId,
        questionId,
      ),
      this.grading.gradesChanged(started, [questionId]),
    ]);
    // While Ask the room is offered an answer may make it ready for any team;
    // each team view carries only its own flag, never how many teams answered.
    const offersRoom =
      started.seededGame.settings.powerUps.ask_the_room.maxUses > 0;
    const answeredTeamIds = answers.map((answer) => answer.teamId);
    // A submitter's own other phones need the new answer even with Ask the room off.
    const changedTeamIds = [
      ...new Set([
        ...(findQuestionOpenForAnswering(graded, questionId) && offersRoom
          ? Object.keys(graded.connectedTeamSockets).map(Number)
          : submitterTeamId === null
            ? answeredTeamIds // a hand grade changes the answering teams' grades
            : []),
        ...(submitterTeamId === null ? [] : [submitterTeamId]),
      ]),
    ];
    return {
      session: withAnsweredTeamIds(graded, questionId, answeredTeamIds),
      outcome: {
        ...BROADCAST_STATE_OUTCOME,
        answerListQuestionIds: [questionId],
        changedTeamIds,
      },
      touchedScores: true,
    };
  }
}
