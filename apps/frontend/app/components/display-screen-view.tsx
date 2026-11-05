import type { ReactNode } from 'react';
import type {
  DisplayScreen,
  LeaderboardEntry,
  LeagueTop,
  PowerUpCount,
  QuizPreviewContext,
  TeamView,
  TeamsCorrect,
} from '@campus-pubquiz/types';
import {
  ClosestGuessRevealScreen,
  closestGuessAnswerProps,
} from '@/app/components/closest-guess-reveal-screen';
import { Leaderboard } from '@/app/components/leaderboard';
import { RulesContent } from '@/app/components/rules-content';
import { BreakIntroScreen } from '@/app/display/break-intro-screen';
import { BreakReviewScreen } from '@/app/display/break-review-screen';
import { DisplayShowdown } from '@/app/display/display-showdown';
import { EndedScreen } from '@/app/display/ended-screen';
import { JoinOverlayScreen } from '@/app/display/join-overlay-screen';
import { JokerPickScreen } from '@/app/display/joker-pick-screen';
import { LobbyScreen } from '@/app/display/lobby-screen';
import { QuestionDisplay } from '@/app/display/question-display';
import {
  QuestionLockCountdown,
  QuestionLockHeading,
} from '@/app/display/question-lock-countdown';
import { QuestionOpenScreen } from '@/app/display/question-open-screen';
import { RevealEntranceConfig } from '@/app/display/reveal-entrance';
import { RoundOverviewScreen } from '@/app/display/round-overview-screen';
import { RoundTitleCard } from '@/app/display/round-title-card';
import { PowerUpCounts } from '@/app/display/power-up-counts';
import { TeamsCorrectCount } from '@/app/display/teams-correct-count';

/** What only a running session knows. Left out, the live-only parts draw empty. */
export interface DisplayLiveContext {
  teams: TeamView[];
  answeredTeamIds: number[];
  leaderboard: readonly LeaderboardEntry[];
  leagueTop: LeagueTop | null;
  teamsCorrect: TeamsCorrect | null;
  powerUpCounts: PowerUpCount[];
  joinCode: string;
  isConnected: boolean;
  isMediaFullscreen?: boolean;
  isMediaPaused?: boolean;
  isDisplaySoundMuted?: boolean;
  mediaReplayToken?: number;
  kahootQuestionEndsAt: number | null;
  onPickAnotherGame: () => void;
  onWinnerCelebrated: () => void;
}

interface DisplayScreenViewProps {
  screen: DisplayScreen;
  /** What every screen reads about the quiz itself, known without a running session. */
  quiz: QuizPreviewContext;
  live?: DisplayLiveContext;
}

type ScreenOf<Kind extends DisplayScreen['kind']> = Extract<
  DisplayScreen,
  { kind: Kind }
>;

/** What every screen's view is drawn from. */
interface ScreenViewProps<Kind extends DisplayScreen['kind']> {
  screen: ScreenOf<Kind>;
  quiz: QuizPreviewContext;
  settings: QuizPreviewContext['settings'];
  quizStructure: QuizPreviewContext['quizStructure'];
  live: DisplayLiveContext | undefined;
  media: LiveMediaProps;
  /** A preview has no live session: nobody connected, no teams yet. */
  isConnected: boolean;
}

/** Draws one Display screen exactly as the big screen does. */
export function DisplayScreenView({
  screen,
  quiz,
  live,
}: DisplayScreenViewProps): ReactNode {
  const View = SCREEN_VIEWS[screen.kind] as (
    props: ScreenViewProps<DisplayScreen['kind']>,
  ) => ReactNode;
  return (
    <View
      screen={screen}
      quiz={quiz}
      settings={quiz.settings}
      quizStructure={quiz.quizStructure}
      live={live}
      media={liveMediaProps(live)}
      isConnected={live?.isConnected ?? false}
    />
  );
}

function LeaderboardView({
  screen,
  live,
  isConnected,
}: ScreenViewProps<'leaderboard'>): ReactNode {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 px-24 py-10">
      <h1 className="text-center font-display text-display-4xl">
        <span className="text-magenta">Leaderboard</span>
      </h1>
      <Leaderboard
        board={screen.board}
        revealCount={screen.revealCount}
        isConnected={isConnected}
        isFinal={screen.isFinal}
        onWinnerCelebrated={live?.onWinnerCelebrated}
      />
    </div>
  );
}

function LobbyView({ settings, live }: ScreenViewProps<'lobby'>): ReactNode {
  if (!live) return null;
  return (
    <LobbyScreen
      teams={live.teams}
      leagueTop={live.leagueTop}
      isConnected={live.isConnected}
      joinCode={live.joinCode}
      maxPlayersPerTeam={settings.maxPlayersPerTeam}
      extraPlayerPenaltyPoints={settings.extraPlayerPenaltyPoints}
      onPickAnotherGame={live.onPickAnotherGame}
    />
  );
}

function JoinOverlayView({
  settings,
  live,
}: ScreenViewProps<'join_overlay'>): ReactNode {
  if (!live) return null;
  return (
    <JoinOverlayScreen
      joinCode={live.joinCode}
      maxPlayersPerTeam={settings.maxPlayersPerTeam}
      extraPlayerPenaltyPoints={settings.extraPlayerPenaltyPoints}
    />
  );
}

function RulesView({
  settings,
  quizStructure,
}: ScreenViewProps<'rules'>): ReactNode {
  return (
    <div className="flex flex-1 items-center justify-center px-16 py-10">
      <RulesContent quizStructure={quizStructure} settings={settings} />
    </div>
  );
}

function RoundOverviewView({
  quiz,
}: ScreenViewProps<'round_overview'>): ReactNode {
  return (
    <RoundOverviewScreen
      roundTitles={quiz.roundTitles}
      roundCategories={quiz.roundCategories}
      roundAuthors={quiz.roundAuthors}
    />
  );
}

function JokerPickView({
  screen,
  live,
}: ScreenViewProps<'joker_pick'>): ReactNode {
  return (
    <JokerPickScreen
      endsAt={screen.endsAt}
      rounds={screen.rounds}
      teams={live?.teams ?? []}
      pickedTeamIds={screen.pickedTeamIds}
    />
  );
}

function RoundTitleView({ screen }: ScreenViewProps<'round_title'>): ReactNode {
  return (
    <RoundTitleCard
      label={`ROUND ${screen.roundNumber}${screen.category ? ` — ${screen.category}` : ''}`}
      roundTitle={screen.title}
      author={screen.author}
      note={screen.note}
    />
  );
}

function EndedView({ screen, live }: ScreenViewProps<'ended'>): ReactNode {
  return (
    <EndedScreen
      leaderboard={live?.leaderboard ?? []}
      isFeedbackPromptShown={screen.isFeedbackPromptShown}
    />
  );
}

function ShowdownView({
  screen,
  isConnected,
}: ScreenViewProps<'showdown'>): ReactNode {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 py-8 text-center">
      <DisplayShowdown
        activeShowdown={screen.showdown}
        step={screen.step}
        isConnected={isConnected}
      />
    </div>
  );
}

function QuestionView({
  screen,
  settings,
  live,
  media,
}: ScreenViewProps<'question'>): ReactNode {
  return (
    <QuestionOpenScreen
      question={screen.question}
      teamCounts={
        live && {
          answeredCount: live.answeredTeamIds.length,
          totalTeams: live.teams.length,
        }
      }
      autoplayMedia={settings.autoplayMedia}
      {...media}
      kahootQuestionEndsAt={live?.kahootQuestionEndsAt}
    />
  );
}

function LockingView({ screen }: ScreenViewProps<'locking'>): ReactNode {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
      <QuestionLockHeading
        key={`heading-${screen.lockAt}`}
        lockAt={screen.lockAt}
      />
      <QuestionLockCountdown
        key={`ring-${screen.lockAt}`}
        lockAt={screen.lockAt}
      />
    </div>
  );
}

function BreakIntroView({
  screen,
  settings,
  quizStructure,
}: ScreenViewProps<'break_intro'>): ReactNode {
  return (
    <BreakIntroScreen
      roundNumber={screen.roundNumber}
      breakNumber={screen.breakNumber}
      enabledBonusCategories={settings.enabledBonusCategories}
      breakEndsAt={screen.breakEndsAt}
      quizStructure={quizStructure}
      showBonusList={!screen.isFinalBreak}
      isFeedbackPromptShown={screen.isFeedbackPromptShown}
      funFacts={screen.funFacts}
    />
  );
}

function BreakReviewView({
  screen,
  settings,
  media,
}: ScreenViewProps<'break_review'>): ReactNode {
  return (
    <BreakReviewScreen
      question={screen.question}
      autoplayMedia={settings.autoplayMedia}
      isDisplaySoundMuted={media.isDisplaySoundMuted}
    />
  );
}

function BreakRoundTitleView({
  screen,
}: ScreenViewProps<'break_round_title'>): ReactNode {
  return (
    <RoundTitleCard
      label={`ROUND ${screen.roundNumber}`}
      roundTitle={screen.title}
      note={screen.note}
    />
  );
}

function RevealIntroView({
  screen,
}: ScreenViewProps<'reveal_intro'>): ReactNode {
  return (
    <RoundTitleCard
      label={`REVEALING ANSWERS · ROUND ${screen.roundNumber}`}
      roundTitle={screen.title}
    />
  );
}

function RevealView({
  screen,
  settings,
  live,
  media,
}: ScreenViewProps<'reveal'>): ReactNode {
  return (
    <RevealScreen
      screen={screen}
      autoplayMedia={settings.autoplayMedia}
      media={media}
      live={live}
    />
  );
}

const SCREEN_VIEWS: {
  [Kind in DisplayScreen['kind']]: (props: ScreenViewProps<Kind>) => ReactNode;
} = {
  leaderboard: LeaderboardView,
  lobby: LobbyView,
  join_overlay: JoinOverlayView,
  rules: RulesView,
  round_overview: RoundOverviewView,
  joker_pick: JokerPickView,
  round_title: RoundTitleView,
  ended: EndedView,
  showdown: ShowdownView,
  blank: () => null,
  question: QuestionView,
  locking: LockingView,
  break_intro: BreakIntroView,
  break_review: BreakReviewView,
  break_round_title: BreakRoundTitleView,
  reveal_intro: RevealIntroView,
  reveal: RevealView,
};

/** The screens of the block in play: its questions, the break and the reveal. */

type LiveMediaProps = ReturnType<typeof liveMediaProps>;

/** The media flags a live screen passes to its player; absent in a preview. */
function liveMediaProps(live: DisplayScreenViewProps['live']) {
  return {
    isFullscreen: live?.isMediaFullscreen,
    mediaReplayToken: live?.mediaReplayToken,
    isMediaPaused: live?.isMediaPaused,
    isDisplaySoundMuted: live?.isDisplaySoundMuted,
  };
}

function RevealScreen({
  screen,
  autoplayMedia,
  media,
  live,
}: {
  screen: Extract<DisplayScreenViewProps['screen'], { kind: 'reveal' }>;
  autoplayMedia: boolean;
  media: LiveMediaProps;
  live: DisplayScreenViewProps['live'];
}): ReactNode {
  const revealQuestion = screen.question;
  switch (revealQuestion.revealKind) {
    case 'closest_guess':
    case 'closest_guess_pending': {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
          <RevealEntranceConfig>
            <ClosestGuessRevealScreen
              prompt={revealQuestion.prompt}
              closestGuess={revealQuestion.closestGuess}
              mediaTestIdPrefix="reveal"
              autoplayMedia={autoplayMedia}
              {...media}
              hasEntrance
              revealNotes={screen.notes}
              {...closestGuessAnswerProps(revealQuestion)}
            />
          </RevealEntranceConfig>
        </div>
      );
    }
    case 'answer':
      return (
        <AnswerRevealScreen
          question={revealQuestion}
          notes={screen.notes}
          autoplayMedia={autoplayMedia}
          media={media}
          live={live}
        />
      );
    default: {
      const unhandled: never = revealQuestion;
      return unhandled;
    }
  }
}

/** An answer's reveal, with how many teams got it and the power-ups used on it. */
function AnswerRevealScreen({
  question: revealQuestion,
  notes,
  autoplayMedia,
  media,
  live,
}: {
  question: Extract<
    Extract<DisplayScreen, { kind: 'reveal' }>['question'],
    { revealKind: 'answer' }
  >;
  notes: Extract<DisplayScreen, { kind: 'reveal' }>['notes'];
  autoplayMedia: boolean;
  media: LiveMediaProps;
  live: DisplayScreenViewProps['live'];
}) {
  const teamsCorrect = live?.teamsCorrect;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
      <RevealEntranceConfig>
        <QuestionDisplay
          question={revealQuestion}
          mediaTestIdPrefix="reveal"
          autoplayMedia={autoplayMedia}
          {...media}
          hasRevealEntrance
          revealNotes={notes}
        />
      </RevealEntranceConfig>
      {teamsCorrect && teamsCorrect.teamCount > 0 && (
        <TeamsCorrectCount {...teamsCorrect} />
      )}
      <PowerUpCounts counts={live?.powerUpCounts ?? []} />
    </div>
  );
}
