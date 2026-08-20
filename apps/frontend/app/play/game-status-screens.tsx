import type { GameProgress, QuizStructureSummary } from '@campus-pubquiz/types';
import { RulesContent } from '@/app/components/rules-content';

interface GameStatusScreensProps {
  progress: GameProgress;
  isAnswerable: boolean;
  quizStructure: QuizStructureSummary;
  roundTitle: string;
  joinCode: string;
  rules: string[];
}

/** The non-block-browser screens: leaderboard overlay, lobby, rules, round intro, and ended — whichever applies to the current status. Renders nothing when the block browser should be shown instead. */
export function GameStatusScreens({
  progress,
  isAnswerable,
  quizStructure,
  roundTitle,
  joinCode,
  rules,
}: GameStatusScreensProps) {
  return (
    <>
      {progress.isLeaderboardVisible && !isAnswerable && (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-extrabold tracking-wide text-foreground/55">
            👀 Look at the screen
          </p>
          <h1 className="font-display text-2xl text-magenta">Leaderboard</h1>
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <div className="mt-16 flex flex-col items-center gap-3">
          <h1 className="text-center font-display text-2xl">
            Waiting for the quiz to start…
          </h1>
          <a
            href={`/rules?code=${joinCode}`}
            className="text-sm font-extrabold text-cyan underline"
          >
            Read the rules
          </a>
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'rules' && (
        <div className="mt-6">
          <RulesContent quizStructure={quizStructure} rules={rules} />
        </div>
      )}
      {/* Only for a genuinely fresh round (nothing opened yet) - if Previous
          stepped the display back into an already-open round's intro card,
          isAnswerable is true and the block browser renders instead so
          teams can keep answering underneath the card. */}
      {!progress.isLeaderboardVisible &&
        progress.status === 'round_intro' &&
        !isAnswerable && (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
            <h1 className="font-display text-2xl">{roundTitle}</h1>
          </div>
        )}
      {!progress.isLeaderboardVisible && progress.status === 'ended' && (
        <h1 className="mt-16 text-center font-display text-2xl">
          Quiz complete!
        </h1>
      )}
    </>
  );
}
