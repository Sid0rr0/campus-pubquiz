import type { LeaderboardEntry } from '@campus-pubquiz/types';
import { Podium, podiumEntries } from '@/app/components/podium';
import { RosterMarquee } from '@/app/display/roster-marquee';
import { formatRankLabel } from '@/app/lib/rank-label';

const TEAM_TEXT_CLASSES = [
  'text-cyan',
  'text-magenta',
  'text-green',
  'text-orange',
];

const THANK_YOU = "Thank you for playing today's pub quiz!";
const FEEDBACK_INVITE =
  'Rate the rounds and help us make the quiz better - on your phones or talk to us.';
const SEE_YOU = 'See you next week!';

interface EndedScreenProps {
  leaderboard: readonly LeaderboardEntry[];
  isFeedbackPromptShown: boolean;
}

/** The final screen: podium on top, the rest of the field scrolling below it, then the thank-you. */
export function EndedScreen({
  leaderboard,
  isFeedbackPromptShown,
}: EndedScreenProps) {
  const onPodium = new Set(podiumEntries(leaderboard));
  const otherTeams = leaderboard.filter((entry) => !onPodium.has(entry));
  const thankYou = isFeedbackPromptShown
    ? `${THANK_YOU} ${FEEDBACK_INVITE} ${SEE_YOU}`
    : `${THANK_YOU} ${SEE_YOU}`;

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-16 pt-10 pb-10 text-center">
      <Podium entries={leaderboard} />
      <h1 className="font-display text-display-4xl">Quiz complete!</h1>
      {otherTeams.length > 0 && (
        <div aria-label="Other teams" className="w-full">
          <RosterMarquee
            items={otherTeams}
            renderItems={() =>
              otherTeams.map((entry, index) => (
                <span
                  key={entry.teamId}
                  role="listitem"
                  className={`font-display text-display-2xl whitespace-nowrap ${TEAM_TEXT_CLASSES[index % TEAM_TEXT_CLASSES.length]}`}
                >
                  {`${formatRankLabel(entry)} ${entry.teamName}`}
                </span>
              ))
            }
          />
        </div>
      )}
      <p className="max-w-5xl font-display text-display-2xl text-magenta">
        {thankYou}
      </p>
    </div>
  );
}
