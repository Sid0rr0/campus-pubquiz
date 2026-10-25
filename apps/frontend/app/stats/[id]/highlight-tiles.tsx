import type {
  SessionDetailFeedback,
  SessionDetailStats,
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

/** The tiles drawn from what teams said; each reads "Feedback was off" when the session didn't collect it. */
function FeedbackTiles({ feedback }: { feedback: SessionDetailFeedback }) {
  const tiles = [ratingTile(feedback.rating)];
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
  const averageTeamTotal =
    data.standings.length > 0
      ? data.standings.reduce((sum, s) => sum + s.total, 0) /
        data.standings.length
      : 0;
  const bonusBreakdown = Object.entries(highlights.bonus.byCategory)
    .filter(([, points]) => points !== 0)
    .map(
      ([category, points]) =>
        `${BONUS_CATEGORY_LABELS[category] ?? category} ${points}`,
    )
    .join(', ');

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
        value={reportedTeams > 0 ? String(playerCount.total) : '—'}
        detail={`${reportedTeams} of ${data.teamCount} teams reported`}
      />
      <StatTile
        label="Avg. team size"
        value={
          playerCount.average === null
            ? '—'
            : String(Math.round(playerCount.average * 10) / 10)
        }
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
        value={
          highlights.winningMargin === null
            ? '—'
            : `${highlights.winningMargin} pts`
        }
      />
    </div>
  );
}
