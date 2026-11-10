import type { ScreenViewProps } from '@/app/components/display-screen-view';
import { QuestionDisplay } from '@/app/display/question-display';
import { QuestionLockCountdown } from '@/app/display/question-lock-countdown';

const COUNT_CLASS_NAME =
  'pt-8 text-display-2xl font-extrabold tracking-wide text-foreground/55';

/** The live answered count; without a live context its line keeps its place but draws empty. */
function AnsweredCount({
  answeredCount,
  totalTeams,
}: {
  answeredCount: number;
  totalTeams: number;
}) {
  return (
    totalTeams > 0 && (
      <p className={COUNT_CLASS_NAME}>
        {answeredCount} OF {totalTeams} TEAMS ANSWERED
      </p>
    )
  );
}

export function QuestionOpenScreen({
  screen,
  settings,
  live,
  media,
}: ScreenViewProps<'question'>) {
  const quickfireQuestionEndsAt = live?.quickfireQuestionEndsAt;
  return (
    <div className="flex min-h-0 flex-1 flex-col px-16 pb-8 pt-16 text-center">
      {quickfireQuestionEndsAt != null && (
        <QuestionLockCountdown
          key={`quickfire-ring-${quickfireQuestionEndsAt}`}
          lockAt={quickfireQuestionEndsAt}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
        <QuestionDisplay
          question={screen.question}
          mediaTestIdPrefix="question"
          autoplayMedia={settings.autoplayMedia}
          {...media}
        />
      </div>
      {live === undefined ? (
        <p aria-hidden className={`${COUNT_CLASS_NAME} invisible`}>
          &nbsp;
        </p>
      ) : (
        <AnsweredCount
          answeredCount={live.answeredTeamIds.length}
          totalTeams={live.teams.length}
        />
      )}
    </div>
  );
}
