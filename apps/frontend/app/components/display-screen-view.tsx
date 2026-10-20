import type { ReactNode } from 'react';
import type {
  DisplayScreen,
  LeaderboardEntry,
  LeagueTop,
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
import { TeamsCorrectCount } from '@/app/display/teams-correct-count';

/** What only a running session knows. Left out, the live-only parts draw empty. */
export interface DisplayLiveContext {
  teams: TeamView[];
  answeredTeamIds: number[];
  leaderboard: readonly LeaderboardEntry[];
  leagueTop: LeagueTop | null;
  teamsCorrect: TeamsCorrect | null;
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

/** Draws one Display screen exactly as the big screen does. */
export function DisplayScreenView({
  screen,
  quiz,
  live,
}: DisplayScreenViewProps): ReactNode {
  const { settings, quizStructure } = quiz;

  switch (screen.kind) {
    case 'leaderboard':
      return (
        <div className="flex flex-1 flex-col justify-center gap-6 px-24 py-10">
          <h1 className="text-center font-display text-display-4xl">
            <span className="text-magenta">Leaderboard</span>
          </h1>
          <Leaderboard
            board={screen.board}
            revealCount={screen.revealCount}
            isConnected={live?.isConnected ?? false}
            isFinal={screen.isFinal}
            onWinnerCelebrated={live?.onWinnerCelebrated}
          />
        </div>
      );
    case 'lobby':
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
    case 'join_overlay':
      if (!live) return null;
      return (
        <JoinOverlayScreen
          joinCode={live.joinCode}
          maxPlayersPerTeam={settings.maxPlayersPerTeam}
          extraPlayerPenaltyPoints={settings.extraPlayerPenaltyPoints}
        />
      );
    case 'rules':
      return (
        <div className="flex flex-1 items-center justify-center px-16 py-10">
          <RulesContent quizStructure={quizStructure} settings={settings} />
        </div>
      );
    case 'round_overview':
      return (
        <RoundOverviewScreen
          roundTitles={quiz.roundTitles}
          roundCategories={quiz.roundCategories}
          roundAuthors={quiz.roundAuthors}
        />
      );
    case 'round_title':
      return (
        <RoundTitleCard
          label={`ROUND ${screen.roundNumber}${screen.category ? ` — ${screen.category}` : ''}`}
          roundTitle={screen.title}
          author={screen.author}
          note={screen.note}
        />
      );
    case 'question':
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
          isFullscreen={live?.isMediaFullscreen}
          mediaReplayToken={live?.mediaReplayToken}
          isMediaPaused={live?.isMediaPaused}
          isDisplaySoundMuted={live?.isDisplaySoundMuted}
          kahootQuestionEndsAt={live?.kahootQuestionEndsAt}
        />
      );
    case 'locking':
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
    case 'break_intro':
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
    case 'break_review':
      return (
        <BreakReviewScreen
          question={screen.question}
          autoplayMedia={settings.autoplayMedia}
          isDisplaySoundMuted={live?.isDisplaySoundMuted}
        />
      );
    case 'break_round_title':
      return (
        <RoundTitleCard
          label={`ROUND ${screen.roundNumber}`}
          roundTitle={screen.title}
          note={screen.note}
        />
      );
    case 'reveal_intro':
      return (
        <RoundTitleCard
          label={`REVEALING ANSWERS · ROUND ${screen.roundNumber}`}
          roundTitle={screen.title}
        />
      );
    case 'reveal': {
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
                  autoplayMedia={settings.autoplayMedia}
                  isDisplaySoundMuted={live?.isDisplaySoundMuted}
                  hasEntrance
                  {...closestGuessAnswerProps(revealQuestion)}
                />
              </RevealEntranceConfig>
            </div>
          );
        }
        case 'answer': {
          const teamsCorrect = live?.teamsCorrect;
          return (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
              <RevealEntranceConfig>
                <QuestionDisplay
                  question={revealQuestion}
                  mediaTestIdPrefix="reveal"
                  autoplayMedia={settings.autoplayMedia}
                  isFullscreen={live?.isMediaFullscreen}
                  mediaReplayToken={live?.mediaReplayToken}
                  isMediaPaused={live?.isMediaPaused}
                  isDisplaySoundMuted={live?.isDisplaySoundMuted}
                  hasRevealEntrance
                />
              </RevealEntranceConfig>
              {teamsCorrect && teamsCorrect.teamCount > 0 && (
                <TeamsCorrectCount {...teamsCorrect} />
              )}
            </div>
          );
        }
        default: {
          const unhandled: never = revealQuestion;
          return unhandled;
        }
      }
    }
    case 'ended':
      return (
        <EndedScreen
          leaderboard={live?.leaderboard ?? []}
          isFeedbackPromptShown={screen.isFeedbackPromptShown}
        />
      );
    case 'showdown':
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 py-8 text-center">
          <DisplayShowdown
            activeShowdown={screen.showdown}
            step={screen.step}
            isConnected={live?.isConnected ?? false}
          />
        </div>
      );
    case 'blank':
      return null;
    default: {
      const unhandled: never = screen;
      return unhandled;
    }
  }
}
