import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import type {
  AnswerView,
  LeaderboardEntry,
  MatchScoringMode,
  ScoredQuestion,
  TeamAnswerView,
} from '@campus-pubquiz/types';
import {
  gradeClosestGuessBatch,
  isAutoGradedType,
  isOverridableType,
  scoreSubmission,
} from '@campus-pubquiz/types';
import { Answer } from '@/db/entities/answer.entity';
import { GameSessionTeam } from '@/db/entities/game-session-team.entity';
import { Question } from '@/db/entities/question.entity';
import { Team } from '@/db/entities/team.entity';
import { AnswerRepository } from '@/db/repositories/answer.repository';
import { GameSessionTeamRepository } from '@/db/repositories/game-session-team.repository';
import { QuestionRepository } from '@/db/repositories/question.repository';
import { TeamRepository } from '@/db/repositories/team.repository';

export interface SubmittedAnswer {
  answerId: number;
  teamId: number;
  teamName: string;
  value: string;
  pointsAwarded: number;
  gradedAt: string | null;
}

export interface GradedAnswer {
  questionId: number;
}

interface LeaderboardRow {
  teamId: number;
  teamName: string;
  quizPoints: string | number;
  bonusPoints: string | number;
  positiveBonusPoints: string | number;
  negativeBonusPoints: string | number;
}

interface RoundRow {
  roundId: number;
  roundTitle: string;
}

interface RoundTotalRow {
  roundId: number;
  teamId: number;
  total: string | number;
}

/** A question as grading sees it: the scoring inputs plus the id its answers hang off. RevealQuestionView satisfies it. */
export type GradableQuestion = ScoredQuestion & { id: number };

interface QuestionPayload {
  matchScoringMode?: MatchScoringMode;
}

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer) private readonly answers: AnswerRepository,
    @InjectRepository(Team) private readonly teams: TeamRepository,
    @InjectRepository(GameSessionTeam)
    private readonly gameSessionTeams: GameSessionTeamRepository,
    @InjectRepository(Question)
    private readonly questions: QuestionRepository,
  ) {}

  async submit(
    gameSessionId: number,
    questionId: number,
    teamId: number,
    value: string,
    responseMs: number | null = null,
  ): Promise<SubmittedAnswer> {
    const row = await this.questions.findOneOrFail(questionId, {
      fields: ['type', 'answer', 'points', 'payload'],
    });
    const question: ScoredQuestion = {
      type: row.type,
      answer: row.answer,
      points: row.points,
      matchScoringMode: (row.payload as QuestionPayload).matchScoringMode,
    };
    // Multiple choice, sort, match, and free_text are all gradable without
    // admin judgement the instant they're submitted (see Scoring's
    // AUTO_GRADED_TYPES), unlike audio/youtube. How a submission scores is
    // entirely Scoring's concern.
    const isAutoGraded = isAutoGradedType(question.type);
    const pointsAwarded = isAutoGraded
      ? scoreSubmission(question, value).points
      : 0;

    // The admin can grade audio/youtube answers (the remaining non-auto-
    // graded types) as soon as they land (grade() has no status gate — see
    // control's "Grade Questions" panel), well before the block locks. A
    // team can then revise its answer (last-write-wins, allowed until lock)
    // — if that revision changes the value, any manual grade already given
    // belongs to the *old* value and must not silently carry over onto the
    // new one. Auto-graded types (including free_text) skip this entirely:
    // every resubmission is just re-graded against its new value below.
    const existing = await this.answers.findOne(
      { gameSession: gameSessionId, question: questionId, team: teamId },
      { fields: ['value'] },
    );
    const resetsGrading =
      !isAutoGraded && existing !== null && existing.value !== value;

    // upsert() bypasses the @Property({ onCreate/onUpdate }) hooks — set the
    // timestamps explicitly (see TeamService.addToRoster for the same fix).
    const now = new Date();
    const answer = await this.answers.upsert(
      {
        gameSession: gameSessionId,
        question: questionId,
        team: teamId,
        value,
        pointsAwarded,
        responseMs,
        ...(isAutoGraded ? { gradedAt: now } : {}),
        ...(resetsGrading ? { gradedAt: null } : {}),
        createdAt: now,
        updatedAt: now,
      },
      {
        onConflictFields: ['gameSession', 'question', 'team'],
        onConflictAction: 'merge',
        onConflictMergeFields:
          isAutoGraded || resetsGrading
            ? ['value', 'updatedAt', 'pointsAwarded', 'gradedAt', 'responseMs']
            : ['value', 'updatedAt', 'responseMs'],
      },
    );

    const team = await this.teams.findOneOrFail(teamId, { fields: ['name'] });

    return {
      answerId: answer.id,
      teamId,
      teamName: team.name,
      value: answer.value,
      pointsAwarded: answer.pointsAwarded,
      gradedAt: answer.gradedAt?.toISOString() ?? null,
    };
  }

  async listForQuestion(
    gameSessionId: number,
    questionId: number,
  ): Promise<AnswerView[]> {
    const rows = await this.answers.find(
      { gameSession: gameSessionId, question: questionId },
      { populate: ['team'], orderBy: { team: { name: 'asc' } } },
    );
    return rows.map((row) => ({
      answerId: row.id,
      teamId: row.team.id,
      teamName: row.team.name,
      value: row.value,
      pointsAwarded: row.pointsAwarded,
      gradedAt: row.gradedAt?.toISOString() ?? null,
    }));
  }

  /**
   * IDs among `questionIds` that have at least one submitted answer still
   * missing `gradedAt` — the source of truth behind the "not yet graded"
   * gate/dot. `questionIds` is expected to already exclude closest_guess
   * questions (they grade themselves automatically); this method doesn't
   * care about type, it just reports what's ungraded.
   */
  async listUngradedQuestionIds(
    gameSessionId: number,
    questionIds: number[],
  ): Promise<number[]> {
    if (questionIds.length === 0) return [];
    const knex = this.answers.getKnex();
    const rows = (await knex('answers')
      .where('game_session_id', gameSessionId)
      .whereIn('question_id', questionIds)
      .whereNull('graded_at')
      .distinct('question_id')) as { question_id: number }[];
    return rows.map((row) => row.question_id);
  }

  async listForTeam(
    gameSessionId: number,
    teamId: number,
  ): Promise<TeamAnswerView[]> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      team: teamId,
    });
    return rows.map((row) => ({
      questionId: row.question.id,
      value: row.value,
      pointsAwarded: row.pointsAwarded,
      gradedAt: row.gradedAt?.toISOString() ?? null,
    }));
  }

  async grade(
    gameSessionId: number,
    answerId: number,
    pointsAwarded: number,
  ): Promise<GradedAnswer> {
    const answer = await this.answers.findOneOrFail(
      { id: answerId, gameSession: gameSessionId },
      { populate: ['question'] },
    );
    // Auto-graded types (match's per-pair partial credit, a free_text
    // synonym the exact match missed) are only a starting point — the quiz
    // master may override them here. closest_guess can't be overridden: it's
    // recomputed as a batch.
    if (!isOverridableType(answer.question.type)) {
      throw new Error(
        'closest_guess answers are graded automatically and cannot be graded manually',
      );
    }
    answer.pointsAwarded = pointsAwarded;
    answer.gradedAt = new Date();
    await this.answers.getEntityManager().flush();
    return { questionId: answer.question.id };
  }

  /**
   * Re-scores every existing answer to an auto-graded question (see
   * Scoring's AUTO_GRADED_TYPES) against the corrected `question` — used
   * after a live edit to an already-shown question. Deliberately overwrites
   * any manual override (e.g. adjusted match partial credit): the key it was
   * judged against just changed, and the admin can override again in break.
   * `kahootTimerSeconds` is the session's configured kahoot question timer
   * for a kahootMode question, null otherwise (or when unlimited): when set,
   * each answer is speed-scaled by the response time stored at submit, so a
   * regrade after a backend restart gives the same points as one without.
   */
  async regradeAutoGraded(
    gameSessionId: number,
    question: GradableQuestion,
    kahootTimerSeconds: number | null = null,
  ): Promise<void> {
    const rows = await this.answers.find({
      gameSession: gameSessionId,
      question: question.id,
    });
    if (rows.length === 0) return;

    const timerMs =
      kahootTimerSeconds === null ? null : kahootTimerSeconds * 1000;
    const now = new Date();
    for (const row of rows) {
      row.pointsAwarded = scoreSubmission(
        question,
        row.value,
        timerMs === null ? undefined : { responseMs: row.responseMs, timerMs },
      ).points;
      row.gradedAt = now;
    }
    await this.answers.getEntityManager().flush();
  }

  /**
   * Batch-grades every submitted guess for a closest_guess question (see
   * Scoring's gradeClosestGuessBatch for the rule). Can only run once all
   * teams are done answering (needs every guess to know who's closest),
   * unlike the types graded at submit() time. Safe to call more than once
   * for the same question — unconditionally recomputes and overwrites, same
   * "recompute is idempotent" convention as computeLeaderboard.
   */
  async gradeClosestGuess(
    gameSessionId: number,
    question: GradableQuestion,
  ): Promise<AnswerView[]> {
    const rows = await this.answers.find(
      { gameSession: gameSessionId, question: question.id },
      { populate: ['team'] },
    );
    if (rows.length === 0) return [];

    const results = gradeClosestGuessBatch(
      question,
      rows.map((row) => row.value),
    );
    const now = new Date();
    rows.forEach((row, index) => {
      row.pointsAwarded = results[index].points;
      row.gradedAt = now;
    });
    await this.answers.getEntityManager().flush();

    return rows
      .map((row) => ({
        answerId: row.id,
        teamId: row.team.id,
        teamName: row.team.name,
        value: row.value,
        pointsAwarded: row.pointsAwarded,
        gradedAt: row.gradedAt!.toISOString(),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }

  /**
   * Scales a kahootMode question's points by answer speed once it locks (the
   * formula lives in Scoring's speedMultiplier), reading each answer's
   * response time as stored at submit — measured from the phase start and
   * overwritten on every resubmission, so a team that revises before lock is
   * timed from its last submission. `questionTimerSeconds` is the session's
   * configured `kahootQuestionTimerSeconds` (the real, fixed timer), not
   * however long the question actually stayed open — so a manual early lock
   * doesn't distort the ratio; null (unlimited) means no scaling. Re-scores
   * every row against `question`, so a key corrected before lock counts —
   * wrong answers stay at 0 regardless of speed. Idempotent: scores are
   * recomputed from the stored value and response time, never from the
   * current pointsAwarded, so a redundant re-run can't compound the scaling.
   */
  async applyKahootSpeedScoring(
    gameSessionId: number,
    question: GradableQuestion,
    questionTimerSeconds: number | null,
  ): Promise<void> {
    // Kahoot rounds only hold auto-graded types (Scoring's
    // KAHOOT_ALLOWED_TYPES); never overwrite a human or batch grade.
    if (!isAutoGradedType(question.type)) return;
    await this.regradeAutoGraded(gameSessionId, question, questionTimerSeconds);
  }

  async computeLeaderboard(gameSessionId: number): Promise<LeaderboardEntry[]> {
    const knex = this.gameSessionTeams.getKnex();
    // Pre-aggregated as subqueries (rather than two leftJoins straight off
    // "t") so a team with several answers *and* several bonus awards doesn't
    // fan out into a cross product that inflates both sums.
    const answerTotals = knex('answers')
      .where('game_session_id', gameSessionId)
      .groupBy('team_id')
      .select('team_id')
      .select(knex.raw('sum(points_awarded) as total'));
    const bonusTotals = knex('bonus_awards')
      .where('game_session_id', gameSessionId)
      .groupBy('team_id')
      .select('team_id')
      .select(knex.raw('sum(points) as total'))
      .select(
        knex.raw(
          'sum(case when points > 0 then points else 0 end) as positive_total',
        ),
      )
      .select(
        knex.raw(
          'sum(case when points < 0 then points else 0 end) as negative_total',
        ),
      );

    const rows = (await knex('game_session_teams as gst')
      .join('teams as t', 't.id', 'gst.team_id')
      .leftJoin(answerTotals.as('ans'), 'ans.team_id', 't.id')
      .leftJoin(bonusTotals.as('bonus'), 'bonus.team_id', 't.id')
      .where('gst.game_session_id', gameSessionId)
      .select('t.id as teamId', 't.name as teamName')
      .select(knex.raw('coalesce(ans.total, 0) as "quizPoints"'))
      .select(knex.raw('coalesce(bonus.total, 0) as "bonusPoints"'))
      .select(
        knex.raw('coalesce(bonus.positive_total, 0) as "positiveBonusPoints"'),
      )
      .select(
        knex.raw('coalesce(bonus.negative_total, 0) as "negativeBonusPoints"'),
      )
      .orderBy([
        {
          column: knex.raw('coalesce(ans.total, 0) + coalesce(bonus.total, 0)'),
          order: 'desc',
        },
        { column: 't.name', order: 'asc' },
      ])) as LeaderboardRow[];

    // Rounds belong to the session's *current* quiz, not necessarily the one
    // any given answer was graded under (a mid-game re-import can swap it).
    const rounds = (await knex('rounds as r')
      .join('game_sessions as gs', 'gs.quiz_id', 'r.quiz_id')
      .where('gs.id', gameSessionId)
      .orderBy('r.order_index', 'asc')
      .select('r.id as roundId', 'r.title as roundTitle')) as RoundRow[];

    const roundTotals = (await knex('answers as a')
      .join('questions as q', 'q.id', 'a.question_id')
      .where('a.game_session_id', gameSessionId)
      .groupBy('q.round_id', 'a.team_id')
      .select('q.round_id as roundId', 'a.team_id as teamId')
      .select(knex.raw('sum(a.points_awarded) as total'))) as RoundTotalRow[];

    return rows.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      totalPoints: Number(row.quizPoints) + Number(row.bonusPoints),
      bonusPoints: Number(row.bonusPoints),
      positiveBonusPoints: Number(row.positiveBonusPoints),
      negativeBonusPoints: Number(row.negativeBonusPoints),
      roundPoints: rounds.map((round) => ({
        roundTitle: round.roundTitle,
        points: Number(
          roundTotals.find(
            (total) =>
              total.roundId === round.roundId && total.teamId === row.teamId,
          )?.total ?? 0,
        ),
      })),
    }));
  }
}
