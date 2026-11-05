import {
  sessionScaleEntries,
  type SessionScale,
  type SessionScaleCounts,
  type SessionDetailFeedback,
  type SessionDetailStats,
} from '@campus-pubquiz/types';
import { formatPercent } from '@/app/stats/[id]/format-percent';

interface HighlightTilesProps {
  data: SessionDetailStats;
}

interface StatTileProps {
  label: string;
  value: string;
  detail?: string;
  /** The correct answer of the question the tile is about. */
  answer?: string;
}

export function StatTile({ label, value, detail, answer }: StatTileProps) {
  return (
    <div className="rounded-xl border border-foreground/15 p-4">
      <p className="font-display text-xs uppercase tracking-wide text-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-foreground/60">{detail}</p>}
      {answer && (
        <p
          title={answer}
          className="mt-0.5 line-clamp-2 text-sm text-foreground/60"
        >
          Answer: <span className="font-bold">{answer}</span>
        </p>
      )}
    </div>
  );
}

/** The Session rating as "★ 4.2" with "37 ratings" below, "—" when nobody rated. */
function ratingTile(rating: SessionDetailFeedback['rating']): StatTileProps {
  if (!rating) return { label: 'Rating', value: '—' };
  return {
    label: 'Rating',
    value: `★ ${rating.average.toFixed(1)}`,
    detail: `${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'}`,
  };
}

/** A scale's tile: the most common answer ("Mixed" when the top two tie), with every count in scale order below; "—" when nobody answered. */
function scaleTile<S extends SessionScale>(
  scale: S,
  label: string,
  counts: SessionScaleCounts<S>,
): StatTileProps {
  const entries = sessionScaleEntries(scale, counts);
  const ranked = [...entries].sort((a, b) => b.count - a.count);
  if (ranked[0].count === 0) return { label, value: '—' };
  return {
    label,
    value: ranked[0].count === ranked[1].count ? 'Mixed' : ranked[0].label,
    detail: entries
      .map((entry) => `${entry.count} ${entry.label.toLowerCase()}`)
      .join(' · '),
  };
}

/** The tiles drawn from what teams said; each reads "Feedback was off" when the session didn't collect it. */
function FeedbackTiles({ feedback }: { feedback: SessionDetailFeedback }) {
  const tiles = [
    ratingTile(feedback.rating),
    scaleTile('pacing', 'Pacing', feedback.pacing),
    scaleTile('feltDifficulty', 'Felt difficulty', feedback.feltDifficulty),
  ];
  return tiles.map((tile) =>
    feedback.collected ? (
      <StatTile key={tile.label} {...tile} />
    ) : (
      <StatTile key={tile.label} label={tile.label} value="Feedback was off" />
    ),
  );
}

const BONUS_CATEGORY_LABELS: Record<string, string> = {
  shot: 'Shot',
  selfie: 'Selfie',
  custom: 'Custom',
};

export function HighlightTiles({ data }: HighlightTilesProps) {
  const { highlights, playerCount } = data;
  const { reportedTeams } = playerCount;
  const hardestQuestion = data.questions.find(
    (q) => q.questionId === highlights.hardestQuestionId,
  );
  const hardestRound = data.rounds.find(
    (r) => r.roundId === highlights.hardestRoundId,
  );
  const averageTeamTotal = averageTotalOf(data.standings);
  const bonusBreakdown = bonusBreakdownOf(highlights.bonus.byCategory);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <StatTile
        label="Difficulty"
        value={data.difficulty.label}
        detail={`${data.difficulty.averagePercent.toFixed(0)}% avg`}
      />
      <StatTile
        label="Average score"
        value={`${averageTeamTotal.toFixed(1)} / ${data.maxPoints}`}
      />
      <StatTile
        label="Total players"
        value={reportedTeams > 0 ? String(playerCount.total) : DASH}
        detail={`${reportedTeams} of ${data.teamCount} teams reported`}
      />
      <StatTile
        label="Avg. team size"
        value={orDash(playerCount.average, (average) =>
          String(Math.round(average * 10) / 10),
        )}
      />
      <FeedbackTiles feedback={data.feedback} />
      <StatTile
        label="Hardest question"
        value={formatPercent(hardestQuestion?.correctRate, ' correct')}
        detail={hardestQuestion?.prompt}
        answer={hardestQuestion?.answer}
      />
      <StatTile
        label="Hardest round"
        value={formatPercent(hardestRound?.correctRate, ' correct')}
        detail={hardestRound?.title}
      />
      <StatTile
        label="Everyone got it"
        value={String(highlights.allCorrectQuestionIds.length)}
        detail="questions"
      />
      <StatTile
        label="Nobody got it"
        value={String(highlights.noneCorrectQuestionIds.length)}
        detail="questions"
      />
      <StatTile
        label="Bonus points"
        value={String(highlights.bonus.total)}
        detail={bonusBreakdown || undefined}
      />
      <StatTile
        label="Winning margin"
        value={orDash(highlights.winningMargin, (margin) => `${margin} pts`)}
      />
    </div>
  );
}

const DASH = '—';

/** A dash for a figure the session doesn't have. */
function orDash(
  value: number | null,
  format: (value: number) => string,
): string {
  return value === null ? DASH : format(value);
}

function averageTotalOf(standings: readonly { total: number }[]): number {
  return standings.length > 0
    ? standings.reduce((sum, s) => sum + s.total, 0) / standings.length
    : 0;
}

/** The non-zero bonus categories, as "Shot 4, Selfie 2"; empty when none. */
function bonusBreakdownOf(byCategory: Record<string, number>): string {
  return Object.entries(byCategory)
    .filter(([, points]) => points !== 0)
    .map(
      ([category, points]) =>
        `${BONUS_CATEGORY_LABELS[category] ?? category} ${points}`,
    )
    .join(', ');
}
