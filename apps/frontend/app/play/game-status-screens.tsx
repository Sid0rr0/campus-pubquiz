'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { readStoredIdentity } from '@/app/lib/team-storage';
import type {
  ActiveShowdownView,
  AckResult,
  JokerPickPlayersView,
  LeaderboardEntry,
  PhoneScreen,
  PlayersStatePayload,
  QuizStructureSummary,
  TeamJoker,
} from '@campus-pubquiz/types';
import { JokerPickScreen } from '@/app/play/joker-pick-screen';
import { JokerBadge } from '@/app/play/joker-moment';
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
  /** The team's coins; absent when the session has no power-ups. */
  coins?: number;
  /** Whether one of the coins is the carried coin, for the line saying where it came from. */
  hasCarriedCoin?: boolean;
  phoneLeaderboard: PlayersStatePayload['phoneLeaderboard'];
  /** Whether the phone's connection is live; one-off effects stay silent otherwise. */
  isConnected: boolean;
  teamName: string | null;
  leaderboard: readonly LeaderboardEntry[];
  /** The "How many players does your team have?" card the lobby screen shows under its waiting line. */
  playerCountCard: ReactNode;
  /** The joker pick's deadline and rounds; present only while the status is `joker_pick`. */
  jokerPick: JokerPickPlayersView | null;
  /** The team's own joker as the server last said it. */
  myJoker: TeamJoker | null;
  onPickJoker: (roundId: number) => Promise<AckResult>;
  /** Whether a title card carries the static joker badge: it is the team's joker round's card when it comes back (break round intro, reveal intro). */
  isJokerBadgeShown: boolean;
  onSubmitShowdownGuess: (
    showdownRoundId: number,
    teamId: number,
    value: string,
  ) => Promise<AckResult>;
}

/** "My Team" — only on a phone that has a stored team code to open it with. */
function TeamPageLink() {
  const [hasCode, setHasCode] = useState(false);
  useEffect(() => {
    // Reading localStorage is only possible in the browser, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasCode(Boolean(readStoredIdentity().teamCode));
  }, []);
  if (!hasCode) return null;
  return (
    <Link href="/team" className="text-sm font-extrabold text-cyan underline">
      My Team
    </Link>
  );
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
export function GameStatusScreens(props: GameStatusScreensProps) {
  const placing = usePhoneMoments(props);
  const Screen = STATUS_SCREENS[props.phoneScreen.kind] as (
    props: StatusScreenProps,
  ) => ReactNode;
  return <Screen {...props} placing={placing} />;
}

/**
 * The buzz when the team's showdown turn comes live, and confetti for the
 * podium when the quiz is seen ending live. The first snapshot after a load
 * or reconnect is silent. Returns the team's final placing once ended.
 */
function usePhoneMoments({
  phoneScreen,
  activeShowdown,
  myTeamId,
  isConnected,
  leaderboard,
}: GameStatusScreensProps) {
  const isMyTurn =
    phoneScreen.kind === 'showdown_guessing' &&
    myTeamId !== null &&
    activeShowdown?.participants.some(
      (participant) =>
        participant.teamId === myTeamId && !participant.hasGuessed,
    ) === true;
  useOnLiveForwardMove(isMyTurn ? 1 : 0, isConnected, () => vibrate('turn'));
  const isEnded = phoneScreen.kind === 'ended';
  const placing = isEnded ? describeFinalPlacing(leaderboard, myTeamId) : null;
  // The phone screen is `ended` once any showdown is decided, not before.
  useOnLiveForwardMove(isEnded ? 1 : 0, isConnected, () => {
    if (placing && isPodiumRank(placing.rank)) {
      fireConfetti();
    }
  });
  return placing;
}

type PhoneScreenOf<Kind extends PhoneScreen['kind']> = Extract<
  PhoneScreen,
  { kind: Kind }
>;
type StatusScreenProps<Kind extends PhoneScreen['kind'] = PhoneScreen['kind']> =
  Omit<GameStatusScreensProps, 'phoneScreen'> & {
    phoneScreen: PhoneScreenOf<Kind>;
    placing: ReturnType<typeof describeFinalPlacing> | null;
  };

function LobbyScreen({
  teamName,
  playerCountCard,
  joinCode,
}: StatusScreenProps<'lobby'>) {
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
}

function RoundTitleScreen({
  phoneScreen,
  isJokerBadgeShown,
}: StatusScreenProps<'round_title'>) {
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
      {isJokerBadgeShown && <JokerBadge />}
    </div>
  );
}

function EndedScreen({ placing }: StatusScreenProps<'ended'>) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-center">
      <h1 className="font-display text-2xl">Quiz complete!</h1>
      {placing && (
        <p className="font-display text-xl text-magenta">{placing.text}</p>
      )}
      <TeamPageLink />
    </div>
  );
}

const STATUS_SCREENS: {
  [Kind in PhoneScreen['kind']]: (props: StatusScreenProps<Kind>) => ReactNode;
} = {
  block: () => null,
  leaderboard: ({
    phoneLeaderboard,
    myTeamId,
    isConnected,
    coins,
    hasCarriedCoin,
  }) => (
    <LeaderboardScreen
      board={phoneLeaderboard.board}
      revealCount={phoneLeaderboard.revealCount}
      myTeamId={myTeamId}
      isConnected={isConnected}
      coins={coins}
      hasCarriedCoin={hasCarriedCoin}
    />
  ),
  lobby: LobbyScreen,
  rules: ({ quizStructure, settings, hasCarriedCoin }) => (
    <div className="mt-6">
      <RulesContent
        quizStructure={quizStructure}
        settings={settings}
        hasCarriedCoin={hasCarriedCoin}
      />
    </div>
  ),
  round_overview: () => (
    <LookAtTheScreen className="text-magenta">Rounds</LookAtTheScreen>
  ),
  joker_pick: ({ jokerPick, phoneScreen, myJoker, onPickJoker }) =>
    jokerPick ? (
      <JokerPickScreen
        jokerPick={jokerPick}
        isOpen={phoneScreen.isOpen}
        myJoker={myJoker}
        onPick={onPickJoker}
      />
    ) : null,
  round_title: RoundTitleScreen,
  ended: EndedScreen,
  showdown_reveal: ({ activeShowdown, showdownRevealStep }) =>
    activeShowdown ? (
      <div className="mt-16 flex flex-col items-center gap-6 px-6 text-center">
        <ShowdownRevealScreen
          activeShowdown={activeShowdown}
          step={showdownRevealStep}
        />
      </div>
    ) : null,
  showdown_guessing: ShowdownGuessingScreen,
};

function ShowdownGuessingScreen({
  activeShowdown,
  myTeamId,
  onSubmitShowdownGuess,
}: Pick<
  GameStatusScreensProps,
  'activeShowdown' | 'myTeamId' | 'onSubmitShowdownGuess'
>) {
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
