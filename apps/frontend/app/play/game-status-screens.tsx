import type { ReactNode } from 'react';
import type {
  ActiveShowdownView,
  PhoneScreen,
  QuizStructureSummary,
} from '@campus-pubquiz/types';
import {
  RulesContent,
  type RulesSettings,
} from '@/app/components/rules-content';
import { ShowdownGuessForm } from '@/app/play/showdown-guess-form';
import { ShowdownRevealScreen } from '@/app/components/showdown-reveal-screen';

interface GameStatusScreensProps {
  phoneScreen: PhoneScreen;
  quizStructure: QuizStructureSummary;
  joinCode: string;
  settings: RulesSettings;
  activeShowdown: ActiveShowdownView | null;
  showdownRevealStep: number;
  myTeamId: number | null;
  onSubmitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => void;
}

function LookAtTheScreen({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mt-16 flex flex-col items-center gap-2 text-center">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        👀 Look at the screen
      </p>
      <h1 className={`font-display text-2xl ${className}`}>{children}</h1>
    </div>
  );
}

/**
 * Draws every phone screen except the block browser (`block`, which the page
 * draws itself). One case per kind; a new kind fails to compile until it has
 * a drawing.
 */
export function GameStatusScreens({
  phoneScreen,
  quizStructure,
  joinCode,
  settings,
  activeShowdown,
  showdownRevealStep,
  myTeamId,
  onSubmitShowdownGuess,
}: GameStatusScreensProps) {
  switch (phoneScreen.kind) {
    case 'block':
      return null;
    case 'leaderboard':
      return (
        <LookAtTheScreen className="text-magenta">Leaderboard</LookAtTheScreen>
      );
    case 'lobby':
      return (
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
      );
    case 'rules':
      return (
        <div className="mt-6">
          <RulesContent quizStructure={quizStructure} settings={settings} />
        </div>
      );
    case 'round_overview':
      return <LookAtTheScreen className="text-magenta">Rounds</LookAtTheScreen>;
    case 'round_title':
      return <LookAtTheScreen>{phoneScreen.title}</LookAtTheScreen>;
    case 'ended':
      return (
        <h1 className="mt-16 text-center font-display text-2xl">
          Quiz complete!
        </h1>
      );
    case 'showdown_reveal':
      return activeShowdown ? (
        <div className="mt-16 flex flex-col items-center gap-6 px-6 text-center">
          <ShowdownRevealScreen
            activeShowdown={activeShowdown}
            step={showdownRevealStep}
          />
        </div>
      ) : null;
    case 'showdown_guessing': {
      // The players room is one broadcast for every team, so which of the
      // two screens to draw comes from this phone's own team id.
      const participant =
        activeShowdown && myTeamId !== null
          ? activeShowdown.participants.find(
              (candidate) => candidate.teamId === myTeamId,
            )
          : undefined;
      if (!activeShowdown || myTeamId === null || !participant) {
        return <LookAtTheScreen>Tiebreaker in progress</LookAtTheScreen>;
      }
      return (
        <ShowdownGuessForm
          question={activeShowdown.question}
          hasGuessed={participant.hasGuessed}
          onSubmit={(value) =>
            onSubmitShowdownGuess(activeShowdown.id, myTeamId, value)
          }
        />
      );
    }
    default: {
      const unhandled: never = phoneScreen;
      return unhandled;
    }
  }
}
