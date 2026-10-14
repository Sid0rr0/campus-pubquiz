'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  DEFAULT_SESSION_SETTINGS,
  getBreakNumber,
  isShowingLastBreak,
  type OnAirScreen,
} from '@campus-pubquiz/types';
import { useDisplayGame } from '@/app/lib/use-display-game';
import { useDisplaySoundMuted } from '@/app/lib/use-display-sound-muted';
import { useLockCountdownSound } from '@/app/lib/use-lock-countdown-sound';
import {
  ClosestGuessRevealScreen,
  closestGuessAnswerProps,
} from '@/app/components/closest-guess-reveal-screen';
import { EnableSoundButton } from '@/app/components/enable-sound-button';
import { ShowdownRevealScreen } from '@/app/components/showdown-reveal-screen';
import { Leaderboard } from '@/app/components/leaderboard';
import { RulesContent } from '@/app/components/rules-content';
import { BreakIntroScreen } from '@/app/display/break-intro-screen';
import { BreakReviewScreen } from '@/app/display/break-review-screen';
import { DisplaySessionPicker } from '@/app/display/display-session-picker';
import { JoinOverlayScreen } from '@/app/display/join-overlay-screen';
import { LobbyScreen } from '@/app/display/lobby-screen';
import { QuestionDisplay } from '@/app/display/question-display';
import {
  QuestionLockCountdown,
  QuestionLockHeading,
} from '@/app/display/question-lock-countdown';
import { QuestionOpenScreen } from '@/app/display/question-open-screen';
import { RoundTitleCard } from '@/app/display/round-title-card';
import { RoundOverviewScreen } from '@/app/display/round-overview-screen';
import { TriviaHeader } from '@/app/display/trivia-header';

function DisplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The query parameter pins this connection to a specific game session's
  // code (e.g. a pre-printed URL or a picked session below). No fallback to
  // an implicit "default" session — once more than one game can run at
  // once that would silently point the screen at the wrong game.
  const codeFromUrl = searchParams.get('code') ?? undefined;
  const { snapshot, connectionError } = useDisplayGame(
    Boolean(codeFromUrl),
    codeFromUrl,
  );
  const { needsUnlock: needsSoundUnlock, unlock: unlockSound } =
    useLockCountdownSound({
      lockAt: snapshot?.questionLockAt ?? null,
      enabled:
        snapshot?.settings.playLockCountdownSound ??
        DEFAULT_SESSION_SETTINGS.playLockCountdownSound,
    });

  useDisplaySoundMuted(snapshot?.isDisplaySoundMuted ?? false);

  // An unknown/stale code (e.g. a pre-printed QR for a session that's since
  // ended) silently falls back to the plain picker rather than surfacing a
  // "connection error" for what's normal end-of-game cleanup — this just
  // strips the bad ?code= from the address bar.
  useEffect(() => {
    if (codeFromUrl && connectionError) {
      router.replace('/display');
    }
  }, [codeFromUrl, connectionError, router]);

  if (!codeFromUrl || connectionError) {
    return (
      <DisplaySessionPicker
        onSelectSession={(joinCode) =>
          router.replace(`/display?code=${joinCode}`)
        }
      />
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-display text-2xl text-foreground">Connecting…</p>
      </main>
    );
  }

  const {
    progress,
    currentQuestion,
    quizStructure,
    leaderboardBoard,
    leaderboardRevealCount,
    teams,
    answeredTeamIds,
    blockQuestions,
    revealQuestions,
    roundTitle,
    roundCategory,
    roundAuthor,
    roundTitles,
    roundCategories,
    roundAuthors,
    questionLockAt,
    kahootQuestionEndsAt,
    breakEndsAt,
    displayTextScale,
    settings,
    activeShowdown,
    showdownRevealStep,
    onAirScreen,
    screenKey,
    header: headerContent,
  } = snapshot;

  // The question each break/reveal screen is about was resolved by the
  // server (progress.roundIndex stays pinned to the block's last round
  // there), so it is looked up by id rather than worked out here.
  const screenQuestionId =
    'questionId' in onAirScreen ? onAirScreen.questionId : null;
  const screenBlockQuestion = blockQuestions.find(
    (question) => question.id === screenQuestionId,
  );
  const revealQuestion = revealQuestions.find(
    (question) => question.id === screenQuestionId,
  );
  const breakNumber = getBreakNumber(progress.roundIndex, quizStructure);
  const showBonusList = !isShowingLastBreak(progress, quizStructure);

  function renderScreen(screen: OnAirScreen): ReactNode {
    switch (screen.kind) {
      case 'leaderboard':
        return (
          <div className="flex flex-1 flex-col justify-center gap-6 px-24 py-10">
            <h1 className="text-center font-display text-display-4xl">
              <span className="text-magenta">Leaderboard</span>
            </h1>
            <Leaderboard
              board={leaderboardBoard}
              revealCount={leaderboardRevealCount}
            />
          </div>
        );
      case 'lobby':
        return (
          <LobbyScreen
            teams={teams}
            joinCode={codeFromUrl}
            maxPlayersPerTeam={settings.maxPlayersPerTeam}
            extraPlayerPenaltyPoints={settings.extraPlayerPenaltyPoints}
          />
        );
      case 'join_overlay':
        return (
          <JoinOverlayScreen
            joinCode={codeFromUrl}
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
            roundTitles={roundTitles}
            roundCategories={roundCategories}
            roundAuthors={roundAuthors}
          />
        );
      case 'round_title':
        return (
          <RoundTitleCard
            label={`ROUND ${progress.roundIndex + 1}${roundCategory ? ` — ${roundCategory}` : ''}`}
            roundTitle={roundTitle}
            author={roundAuthor}
          />
        );
      case 'question':
        if (!currentQuestion) return null;
        return (
          <QuestionOpenScreen
            question={currentQuestion}
            answeredCount={answeredTeamIds.length}
            totalTeams={teams.length}
            autoplayMedia={settings.autoplayMedia}
            isFullscreen={progress.isMediaFullscreen}
            mediaReplayToken={progress.mediaReplayToken}
            kahootQuestionEndsAt={kahootQuestionEndsAt}
          />
        );
      case 'locking':
        if (questionLockAt === null) return null;
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
            <QuestionLockHeading
              key={`heading-${questionLockAt}`}
              lockAt={questionLockAt}
            />
            <QuestionLockCountdown
              key={`ring-${questionLockAt}`}
              lockAt={questionLockAt}
            />
          </div>
        );
      case 'break_intro':
        return (
          <BreakIntroScreen
            roundNumber={progress.roundIndex + 1}
            breakNumber={breakNumber}
            enabledBonusCategories={settings.enabledBonusCategories}
            breakEndsAt={breakEndsAt}
            quizStructure={quizStructure}
            showBonusList={showBonusList}
            isFeedbackPromptShown={screen.isFeedbackPromptShown}
          />
        );
      case 'break_review':
        if (!screenBlockQuestion) return null;
        return (
          <BreakReviewScreen
            question={screenBlockQuestion}
            autoplayMedia={settings.autoplayMedia}
          />
        );
      case 'break_round_title':
        if (!screenBlockQuestion) return null;
        return (
          <RoundTitleCard
            label={`ROUND ${screenBlockQuestion.roundNumber}`}
            roundTitle={screenBlockQuestion.roundTitle}
          />
        );
      case 'reveal_intro':
        if (!revealQuestion) return null;
        return (
          <RoundTitleCard
            label={`REVEALING ANSWERS · ROUND ${revealQuestion.roundNumber}`}
            roundTitle={revealQuestion.roundTitle}
          />
        );
      case 'reveal':
        if (!revealQuestion) return null;
        switch (revealQuestion.revealKind) {
          case 'closest_guess':
          case 'closest_guess_pending': {
            return (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
                <ClosestGuessRevealScreen
                  prompt={revealQuestion.prompt}
                  closestGuess={revealQuestion.closestGuess}
                  mediaTestIdPrefix="reveal"
                  autoplayMedia={settings.autoplayMedia}
                  {...closestGuessAnswerProps(revealQuestion)}
                />
              </div>
            );
          }
          case 'answer':
            return (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
                <QuestionDisplay
                  question={revealQuestion}
                  mediaTestIdPrefix="reveal"
                  autoplayMedia={settings.autoplayMedia}
                  isFullscreen={progress.isMediaFullscreen}
                />
              </div>
            );
          default: {
            const unhandled: never = revealQuestion;
            return unhandled;
          }
        }
      case 'ended':
        return (
          <div className="flex flex-1 items-center justify-center px-16 text-center">
            <div className="flex flex-col items-center gap-6">
              <h1 className="font-display text-display-4xl">Quiz complete!</h1>
              {screen.isFeedbackPromptShown && (
                <p className="font-display text-display-2xl text-magenta">
                  Tell us what you thought — on your phone
                </p>
              )}
            </div>
          </div>
        );
      case 'showdown':
        if (!activeShowdown) return null;
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 py-8 text-center">
            <ShowdownRevealScreen
              activeShowdown={activeShowdown}
              step={showdownRevealStep}
            />
          </div>
        );
      default: {
        const unhandled: never = screen;
        return unhandled;
      }
    }
  }

  return (
    <main
      className="flex h-dvh flex-col bg-background text-foreground"
      style={
        { '--display-text-scale': displayTextScale } as React.CSSProperties
      }
    >
      {needsSoundUnlock && <EnableSoundButton onClick={unlockSound} />}
      <TriviaHeader
        label={headerContent.label}
        title={headerContent.title}
        badge={headerContent.badge}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {renderScreen(onAirScreen)}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

export default function DisplayPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <DisplayPageContent />
    </Suspense>
  );
}
