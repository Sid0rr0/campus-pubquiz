'use client';

import type { ReactNode } from 'react';
import type {
  ActiveShowdownView,
  LeaderboardEntry,
  PhoneScreen,
  PlayersStatePayload,
  QuizStructureSummary,
} from '@campus-pubquiz/types';
import { LeaderboardScreen } from '@/app/play/leaderboard-screen';
import {
  RulesContent,
  type RulesSettings,
} from '@/app/components/rules-content';
import { useOnLiveForwardMove } from '@/app/lib/live-change';
import { vibrate } from '@/app/lib/vibrate';
import { EntranceLine } from '@/app/components/round-title-entrance';
import { fireConfetti } from '@/app/lib/confetti';
import { describeFinalPlacing, isPodiumRank } from '@/app/lib/final-placing';
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
  phoneLeaderboard: PlayersStatePayload['phoneLeaderboard'];
  /** Whether the phone's connection is live; one-off effects stay silent otherwise. */
  isConnected: boolean;
  teamName: string | null;
  leaderboard: readonly LeaderboardEntry[];
  /** The "How many players are you?" card the lobby screen shows under its waiting line. */
  playerCountCard: ReactNode;
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
  phoneLeaderboard,
  isConnected,
  teamName,
  onSubmitShowdownGuess,
  leaderboard,
  playerCountCard,
}: GameStatusScreensProps) {
  const isMyTurn =
    phoneScreen.kind === 'showdown_guessing' &&
    myTeamId !== null &&
    activeShowdown?.participants.some(
      (participant) =>
        participant.teamId === myTeamId && !participant.hasGuessed,
    ) === true;
  // The first snapshot after a load or reconnect is silent, so the buzz fires
  // only when the turn comes live.
  useOnLiveForwardMove(isMyTurn ? 1 : 0, isConnected, () => vibrate('turn'));
  const isEnded = phoneScreen.kind === 'ended';
  const placing = isEnded ? describeFinalPlacing(leaderboard, myTeamId) : null;
  // Confetti for the podium only, and only when the quiz is seen ending live:
  // the phone screen is `ended` once any showdown is decided, not before.
  useOnLiveForwardMove(isEnded ? 1 : 0, isConnected, () => {
    if (placing && isPodiumRank(placing.rank)) {
      fireConfetti();
    }
  });

  switch (phoneScreen.kind) {
    case 'block':
      return null;
    case 'leaderboard':
      return (
        <LeaderboardScreen
          board={phoneLeaderboard.board}
          revealCount={phoneLeaderboard.revealCount}
          myTeamId={myTeamId}
          isConnected={isConnected}
        />
      );
    case 'lobby':
      return (
        <div className="mt-16 flex flex-col items-center gap-3">
          <h1 className="text-center font-display text-2xl text-green">
            You&apos;re in!
          </h1>
          <p className="text-center">Look for {teamName} on the big screen</p>
          <p className="text-center text-sm text-foreground/65">
            Waiting for the quiz to start…
          </p>
          {playerCountCard}
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
      return (
        <div
          key={phoneScreen.title}
          className="mt-16 flex flex-col items-center gap-2 text-center"
        >
          <EntranceLine line="kicker">
            <p className="text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
          </EntranceLine>
          <EntranceLine line="title">
            <h1 className="font-display text-2xl">{phoneScreen.title}</h1>
          </EntranceLine>
        </div>
      );
    case 'ended':
      return (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <h1 className="font-display text-2xl">Quiz complete!</h1>
          {placing && (
            <p className="font-display text-xl text-magenta">{placing.text}</p>
          )}
        </div>
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
        return (
          <LookAtTheScreen className="animate-pulse motion-reduce:animate-none">
            Tiebreaker in progress
          </LookAtTheScreen>
        );
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
