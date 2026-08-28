import type {
  ActiveShowdownView,
  BonusCategory,
  GameProgress,
  QuizStructureSummary,
} from '@campus-pubquiz/types';
import { RulesContent } from '@/app/components/rules-content';
import { ShowdownGuessForm } from '@/app/play/showdown-guess-form';
import { ShowdownRevealScreen } from '@/app/components/showdown-reveal-screen';

interface GameStatusScreensProps {
  progress: GameProgress;
  isAnswerable: boolean;
  quizStructure: QuizStructureSummary;
  roundTitle: string;
  revealIntroRoundTitle?: string;
  breakRoundIntroRoundTitle?: string;
  joinCode: string;
  rules: string[];
  enabledBonusCategories: BonusCategory[];
  activeShowdown: ActiveShowdownView | null;
  showdownRevealStep: number;
  myTeamId: number | null;
  onSubmitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => void;
}

/** The non-block-browser screens: leaderboard overlay, lobby, rules, round intro, and ended — whichever applies to the current status. Renders nothing when the block browser should be shown instead. */
export function GameStatusScreens({
  progress,
  isAnswerable,
  quizStructure,
  roundTitle,
  revealIntroRoundTitle,
  breakRoundIntroRoundTitle,
  joinCode,
  rules,
  enabledBonusCategories,
  activeShowdown,
  showdownRevealStep,
  myTeamId,
  onSubmitShowdownGuess,
}: GameStatusScreensProps) {
  const isShowdownParticipant =
    activeShowdown !== null &&
    myTeamId !== null &&
    activeShowdown.participants.some(
      (participant) => participant.teamId === myTeamId,
    );
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
          <RulesContent
            quizStructure={quizStructure}
            rules={rules}
            enabledBonusCategories={enabledBonusCategories}
          />
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
      {/* Reveal crossing into a new round within the same block, or Previous
          stepping back through break to a round's own title card — same
          "look at the screen" treatment as round_intro, but sourced from the
          block/reveal question at revealIndex rather than the top-level
          roundTitle, since progress.roundIndex stays pinned to the block's
          last round throughout break/reveal. */}
      {!progress.isLeaderboardVisible &&
        progress.status === 'reveal_intro' &&
        revealIntroRoundTitle && (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
            <h1 className="font-display text-2xl">{revealIntroRoundTitle}</h1>
          </div>
        )}
      {!progress.isLeaderboardVisible &&
        progress.status === 'break_round_intro' &&
        breakRoundIntroRoundTitle && (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
            <h1 className="font-display text-2xl">
              {breakRoundIntroRoundTitle}
            </h1>
          </div>
        )}
      {!progress.isLeaderboardVisible &&
        progress.status === 'ended' &&
        (!activeShowdown ? (
          <h1 className="mt-16 text-center font-display text-2xl">
            Quiz complete!
          </h1>
        ) : showdownRevealStep > 0 ? (
          <div className="mt-16 flex flex-col items-center gap-6 px-6 text-center">
            <ShowdownRevealScreen
              activeShowdown={activeShowdown}
              step={showdownRevealStep}
            />
          </div>
        ) : isShowdownParticipant && myTeamId !== null ? (
          <ShowdownGuessForm
            question={activeShowdown.question}
            hasGuessed={
              activeShowdown.participants.find(
                (participant) => participant.teamId === myTeamId,
              )?.hasGuessed ?? false
            }
            onSubmit={(value) =>
              onSubmitShowdownGuess(activeShowdown.id, myTeamId, value)
            }
          />
        ) : (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
            <h1 className="font-display text-2xl">Tiebreaker in progress</h1>
          </div>
        ))}
    </>
  );
}
