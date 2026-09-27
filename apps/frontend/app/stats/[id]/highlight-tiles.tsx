import type { SessionDetailStats } from '@campus-pubquiz/types';
import { formatResponseMs } from '@/app/stats/[id]/format-response-ms';

interface HighlightTilesProps {
  data: SessionDetailStats;
}

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/15 p-4">
      <p className="font-display text-xs uppercase tracking-wide text-foreground/60">
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
      {detail && <p className="mt-0.5 text-sm text-foreground/60">{detail}</p>}
    </div>
  );
}

const BONUS_CATEGORY_LABELS: Record<string, string> = {
  shot: 'Shot',
  selfie: 'Selfie',
  custom: 'Custom',
};

export function HighlightTiles({ data }: HighlightTilesProps) {
  const { highlights } = data;
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
        label="Hardest question"
        value={
          hardestQuestion
            ? `${(hardestQuestion.correctRate * 100).toFixed(0)}% correct`
            : '—'
        }
        detail={hardestQuestion?.prompt}
      />
      <StatTile
        label="Hardest round"
        value={
          hardestRound
            ? `${(hardestRound.correctRate * 100).toFixed(0)}% correct`
            : '—'
        }
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
        label="Fastest answer"
        value={
          highlights.fastestAnswer
            ? formatResponseMs(highlights.fastestAnswer.responseMs)
            : 'Not recorded'
        }
        detail={highlights.fastestAnswer?.teamName}
      />
      <StatTile
        label="Fastest team"
        value={
          highlights.fastestTeam
            ? formatResponseMs(highlights.fastestTeam.avgResponseMs)
            : 'Not recorded'
        }
        detail={highlights.fastestTeam?.teamName}
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
