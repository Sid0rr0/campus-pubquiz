import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  getSessionLiveEditFrontier,
  mergeLiveEditFrontiers,
  type ImportRoundPreview,
  type LiveEditFrontier,
  type QuizDraftSaveRequest,
  type QuizDraftSaveResult,
  type SessionState,
} from '@campus-pubquiz/types';
import { SeedService } from '@/db/seed.service';
import { AnswerService } from '@/answer/answer.service';
import { JokerService } from '@/joker/joker.service';
import { PurchaseService } from '@/purchase/purchase.service';
import { PurchaseChanges } from '@/game/state/purchase-changes';
import { TeamService } from '@/team/team.service';
import {
  JOKER_RANDOM,
  JokerChanges,
  type RandomSource,
} from '@/game/state/joker-changes';
import { SessionBroadcaster } from '@/game/socket/session-broadcaster';
import { quizEditChange } from '@/game/live-edit/quiz-edit-change';
import { BlockGradingService } from '@/game/state/block-grading.service';
import type { SessionOutcome } from '@/game/state/session-outcome';
import { SessionWrite, type HeldWriter } from '@/game/state/session-write';
import {
  findDroppedAnsweredQuestions,
  findForeignQuestionIds,
  findLiveEditViolations,
  findRegradeQuestionIds,
  QuizLiveEditBlockedError,
} from '@/quiz/live-edit-guard';
import {
  QuizDraftInvalidError,
  QuizNotFoundError,
  QuizService,
  QuizStaleSaveError,
} from '@/quiz/quiz.service';

/** How a save differs from the editor's plain one — a re-import sheet's. */
export interface LiveEditSaveStrategy {
  /**
   * The rounds the live-edit check compares with the stored ones: a sheet
   * carries no question ids, so each question is taken to be the stored one
   * at the same round and position.
   */
  identifyQuestions(
    stored: readonly ImportRoundPreview[],
    incoming: readonly ImportRoundPreview[],
  ): ImportRoundPreview[];
  /** Writes the rounds, in place of the editor's validating `QuizService.update`. */
  persist(rounds: ImportRoundPreview[]): Promise<QuizDraftSaveResult>;
}

export interface LiveEditSaveOptions {
  /**
   * A session a re-import wants reloaded and broadcast after the save has
   * landed. A lobby session is already reloaded by every save, so this only
   * adds an ended session; a join code already reloaded is skipped.
   */
  reloadJoinCode?: string;
  strategy?: LiveEditSaveStrategy;
}

interface PendingDelivery {
  joinCode: string;
  outcome: SessionOutcome;
}

/**
 * Saves a quiz's title and rounds while sessions may be playing it. With no
 * running session on the quiz it is a plain save. Otherwise the save is
 * checked and applied while every unfinished session is held, so the game
 * can't move past the live-edit frontier the save was checked against: the
 * save either lands with each running session still behind that frontier, or
 * is refused. Either way, once the rounds are saved every unfinished session,
 * lobby ones included, is reloaded and broadcast; only running sessions are
 * regraded.
 */
@Injectable()
export class LiveEditService {
  private readonly logger = new Logger(LiveEditService.name);

  private readonly jokerChanges: JokerChanges;
  private readonly purchaseChanges: PurchaseChanges;

  constructor(
    private readonly quizService: QuizService,
    private readonly broadcaster: SessionBroadcaster,
    private readonly sessionWrite: SessionWrite,
    private readonly seedService: SeedService,
    private readonly grading: BlockGradingService,
    jokerService: JokerService,
    teamService: TeamService,
    purchaseService: PurchaseService,
    answerService: AnswerService,
    @Optional() @Inject(JOKER_RANDOM) random?: RandomSource,
  ) {
    this.purchaseChanges = new PurchaseChanges(
      purchaseService,
      random ?? Math.random,
      answerService,
    );
    this.jokerChanges = new JokerChanges(
      jokerService,
      teamService,
      random ?? Math.random,
    );
  }

  /** Every session on `quizId` that has not ended, lobby sessions included. */
  private listUnfinishedSessions(quizId: number): SessionState[] {
    return this.sessionWrite
      .list()
      .filter(
        (session) =>
          session.seededGame.quizId === quizId &&
          session.progress.status !== 'ended',
      );
  }

  /** Every running session on `quizId` (not in the lobby, not ended) as it stands now. Read it inside the hold to count the sessions the way they stand while the game can't move. */
  private listLiveSessions(quizId: number): SessionState[] {
    return this.listUnfinishedSessions(quizId).filter(
      (session) => session.progress.status !== 'lobby',
    );
  }

  /** The join codes of every unfinished session on `quizId`, lobby sessions included. */
  private unfinishedJoinCodes(quizId: number): string[] {
    return this.listUnfinishedSessions(quizId).map(
      (session) => session.seededGame.joinCode,
    );
  }

  /** Whether any session is running (not lobby, not ended) on the quiz. */
  hasLiveSession(quizId: number): boolean {
    return this.listLiveSessions(quizId).length > 0;
  }

  /** The running sessions' frontiers merged, or null when none is running. */
  getFrontier(quizId: number): LiveEditFrontier | null {
    const sessions = this.listLiveSessions(quizId);
    if (sessions.length === 0) return null;
    return mergeLiveEditFrontiers(
      sessions.map((session) => getSessionLiveEditFrontier(session)),
    );
  }

  /**
   * Throws QuizLiveEditBlockedError (409) when a live session has reached
   * what the save would change, QuizDraftInvalidError (422) for a malformed
   * draft and QuizNotFoundError (404) for an unknown quiz.
   */
  async save(
    quizId: number,
    { title, rounds: requestedRounds, loadedUpdatedAt }: QuizDraftSaveRequest,
    { reloadJoinCode, strategy }: LiveEditSaveOptions = {},
  ): Promise<QuizDraftSaveResult> {
    const deliveries: PendingDelivery[] = [];
    const persist = (rounds: ImportRoundPreview[]) =>
      strategy
        ? strategy.persist(rounds)
        : this.quizService.update(quizId, title, rounds);
    let result: QuizDraftSaveResult;
    try {
      result = await this.sessionWrite.hold(
        this.unfinishedJoinCodes(quizId),
        async (held) => {
          const currentDraft = await this.quizService.findDraftById(quizId);
          if (!currentDraft) throw new QuizNotFoundError(quizId);
          // shortcut: checked and written without a lock when no session is on the quiz (the hold covers none), so two saves landing in the same instant can both pass; fine for two staff, move the check into the UPDATE if it ever matters.
          if (
            loadedUpdatedAt !== undefined &&
            loadedUpdatedAt !== currentDraft.updatedAt
          ) {
            throw new QuizStaleSaveError(quizId);
          }
          const rounds = strategy
            ? strategy.identifyQuestions(currentDraft.rounds, requestedRounds)
            : requestedRounds;
          const foreign = findForeignQuestionIds(currentDraft.rounds, rounds);
          if (foreign.length > 0) throw new QuizDraftInvalidError(foreign);
          const droppedAnswered = findDroppedAnsweredQuestions(
            currentDraft.rounds,
            rounds,
            await this.quizService.answeredQuestionIds(quizId),
          );
          if (droppedAnswered.length > 0) {
            throw new QuizLiveEditBlockedError(
              droppedAnswered,
              droppedAnswered[0].message,
            );
          }

          const liveSessions = this.listLiveSessions(quizId);
          if (liveSessions.length === 0) {
            const saved = await persist(requestedRounds);
            await this.reloadLobbySessions(quizId, held, deliveries);
            return saved;
          }

          const frontier = mergeLiveEditFrontiers(
            liveSessions.map((session) => getSessionLiveEditFrontier(session)),
          );
          const issues = findLiveEditViolations(
            currentDraft.rounds,
            rounds,
            frontier,
          );
          if (issues.length > 0) throw new QuizLiveEditBlockedError(issues);
          const regradeQuestionIds = findRegradeQuestionIds(
            currentDraft.rounds,
            rounds,
            frontier.openedQuestionIds,
          );

          const result = await persist(rounds);
          for (const { seededGame } of liveSessions) {
            deliveries.push({
              joinCode: seededGame.joinCode,
              outcome: await held.write(
                seededGame.joinCode,
                quizEditChange(
                  this.seedService,
                  this.grading,
                  this.jokerChanges,
                  this.purchaseChanges,
                  regradeQuestionIds,
                ),
              ),
            });
          }
          await this.reloadLobbySessions(quizId, held, deliveries);
          return result;
        },
      );
      if (
        reloadJoinCode !== undefined &&
        !deliveries.some((delivery) => delivery.joinCode === reloadJoinCode) &&
        this.sessionWrite.read(reloadJoinCode).seededGame.quizId === quizId
      ) {
        deliveries.push({
          joinCode: reloadJoinCode,
          outcome: await this.sessionWrite.write(
            reloadJoinCode,
            quizEditChange(
              this.seedService,
              this.grading,
              this.jokerChanges,
              this.purchaseChanges,
              [],
            ),
          ),
        });
      }
    } catch (error) {
      // Sessions reloaded before the failure still need their broadcast, but
      // a delivery problem must not hide the error that failed the save.
      await this.deliverAll(deliveries, { swallowErrors: true });
      throw error;
    }
    await this.deliverAll(deliveries, { swallowErrors: false });
    return result;
  }

  /** Inside the hold, once the rounds are saved: reloads each lobby session on the quiz, with no regrade (it has no answers). Its outcome is queued for broadcast. */
  private async reloadLobbySessions(
    quizId: number,
    held: HeldWriter,
    deliveries: PendingDelivery[],
  ): Promise<void> {
    const lobbySessions = this.listUnfinishedSessions(quizId).filter(
      (session) => session.progress.status === 'lobby',
    );
    for (const { seededGame } of lobbySessions) {
      deliveries.push({
        joinCode: seededGame.joinCode,
        outcome: await held.write(
          seededGame.joinCode,
          quizEditChange(
            this.seedService,
            this.grading,
            this.jokerChanges,
            this.purchaseChanges,
            [],
          ),
        ),
      });
    }
  }

  /** After the hold is released, as with every session write. Every delivery is tried; the first failure is rethrown unless errors are swallowed (logged). */
  private async deliverAll(
    deliveries: readonly PendingDelivery[],
    { swallowErrors }: { swallowErrors: boolean },
  ): Promise<void> {
    const failures: unknown[] = [];
    for (const { joinCode, outcome } of deliveries) {
      try {
        await this.broadcaster.deliver(joinCode, outcome);
      } catch (error) {
        this.logger.error(
          `Could not deliver the live-edit outcome to ${joinCode}`,
          error instanceof Error ? error.stack : String(error),
        );
        failures.push(error);
      }
    }
    if (!swallowErrors && failures.length > 0) throw failures[0];
  }
}
