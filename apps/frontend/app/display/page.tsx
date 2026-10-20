'use client';

import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  DEFAULT_SESSION_SETTINGS,
  isGradedStatus,
} from '@campus-pubquiz/types';
import { fireConfetti } from '@/app/lib/confetti';
import { displaySounds } from '@/app/lib/display-sounds';
import { useOnLiveForwardMove } from '@/app/lib/live-change';
import {
  clearStoredDisplayCode,
  readStoredDisplayCode,
  storeDisplayCode,
} from '@/app/lib/display-code-storage';
import { useDisplayGame } from '@/app/lib/use-display-game';
import { revealPosition } from '@/app/lib/reveal-position';
import { useDisplaySoundMuted } from '@/app/lib/use-display-sound-muted';
import { EndedScreen } from '@/app/display/ended-screen';
import { useLockCountdownSound } from '@/app/lib/use-lock-countdown-sound';
import { useRoundTitleSting } from '@/app/lib/use-round-title-sting';
import {
  ClosestGuessRevealScreen,
  closestGuessAnswerProps,
} from '@/app/components/closest-guess-reveal-screen';
import { EnableSoundButton } from '@/app/components/enable-sound-button';
import { DisplayShowdown } from '@/app/display/display-showdown';
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
import { RevealEntranceConfig } from '@/app/display/reveal-entrance';
import { RoundOverviewScreen } from '@/app/display/round-overview-screen';
import { TeamsCorrectCount } from '@/app/display/teams-correct-count';
import { TriviaHeader } from '@/app/display/trivia-header';

function DisplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The query parameter pins this connection to a specific game session's
  // code (e.g. a pre-printed URL or a picked session below). No fallback to
  // an implicit "default" session — once more than one game can run at
  // once that would silently point the screen at the wrong game.
  const codeFromUrl = searchParams.get('code') ?? undefined;
  const { snapshot, connectionError, connectionIssue } = useDisplayGame(
    Boolean(codeFromUrl),
    codeFromUrl,
  );
  const isRefused = connectionIssue === 'refused';
  const isConnected = snapshot !== null && !connectionError;
  const { needsUnlock: needsSoundUnlock, unlock: unlockSound } =
    useLockCountdownSound({
      lockAt: snapshot?.questionLockAt ?? null,
      enabled:
        snapshot?.settings.playLockCountdownSound ??
        DEFAULT_SESSION_SETTINGS.playLockCountdownSound,
      isMuted: snapshot?.isDisplaySoundMuted ?? false,
      isRegistryInUse: true,
    });
  // Set once the final leaderboard has crowned the winner, so Quiz complete
  // doesn't play the same fanfare and confetti a second time.
  const hasWinnerBeenCelebratedRef = useRef(false);
  // Confetti and the fanfare only when the quiz is seen ending live: not on a
  // reloaded display, not on Previous.
  useOnLiveForwardMove(
    snapshot?.screen.kind === 'ended' ? 1 : 0,
    isConnected,
    () => {
      if (hasWinnerBeenCelebratedRef.current) return;
      fireConfetti();
      displaySounds.play('fanfare');
    },
  );

  // The sting plays when the quiz moves forward onto a revealed answer,
  // never for a reloaded screen or a Previous.
  const isRevealOnAir = snapshot?.progress.status === 'reveal';
  useOnLiveForwardMove(
    snapshot ? revealPosition(snapshot.progress) : 0,
    isConnected,
    () => {
      if (isRevealOnAir) displaySounds.play('reveal');
    },
  );

  // The block locking is the end of the countdown: one hit when it is seen
  // live, never for a reloaded screen or a Previous.
  useOnLiveForwardMove(
    snapshot && isGradedStatus(snapshot.progress.status) ? 1 : 0,
    isConnected,
    () => displaySounds.play('timeUp'),
  );

  useRoundTitleSting(
    snapshot
      ? {
          status: snapshot.progress.status,
          roundIndex: snapshot.progress.roundIndex,
          screenKind: snapshot.screen.kind,
        }
      : null,
    isConnected,
  );

  useDisplaySoundMuted(snapshot?.isDisplaySoundMuted ?? false);

  // A bare /display resumes the game this screen last showed, once, on load.
  const hasTriedResumeRef = useRef(false);
  useEffect(() => {
    if (hasTriedResumeRef.current) return;
    hasTriedResumeRef.current = true;
    if (codeFromUrl) return;
    const storedCode = readStoredDisplayCode();
    if (storedCode) router.replace(`/display?code=${storedCode}`);
  }, [codeFromUrl, router]);

  // A code the server has really served is the one to resume after a reload.
  const hasSnapshot = snapshot !== null;
  useEffect(() => {
    if (codeFromUrl && hasSnapshot) storeDisplayCode(codeFromUrl);
  }, [codeFromUrl, hasSnapshot]);

  // An unknown/stale code (e.g. a pre-printed QR for a session that's since
  // ended) silently falls back to the plain picker rather than surfacing a
  // "connection error" for what's normal end-of-game cleanup — this forgets
  // the code and strips the bad ?code= from the address bar. A transient
  // drop (`reconnecting`) is not a refusal: socket.io retries on its own.
  useEffect(() => {
    if (codeFromUrl && isRefused) {
      clearStoredDisplayCode();
      router.replace('/display');
    }
  }, [codeFromUrl, isRefused, router]);

  function pickAnotherGame() {
    clearStoredDisplayCode();
    router.replace('/display');
  }

  if (!codeFromUrl || isRefused) {
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
    quizStructure,
    leaderboard,
    teams,
    answeredTeamIds,
    roundTitles,
    roundCategories,
    roundAuthors,
    kahootQuestionEndsAt,
    teamsCorrect,
    leagueTop,
    displayTextScale,
    settings,
    screen,
    screenKey,
    header: headerContent,
  } = snapshot;

  function renderScreen(): ReactNode {
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
              isConnected={isConnected}
              isFinal={screen.isFinal}
              onWinnerCelebrated={() => {
                hasWinnerBeenCelebratedRef.current = true;
              }}
            />
          </div>
        );
      case 'lobby':
        return (
          <LobbyScreen
            teams={teams}
            leagueTop={leagueTop}
            isConnected={isConnected}
            joinCode={codeFromUrl}
            maxPlayersPerTeam={settings.maxPlayersPerTeam}
            extraPlayerPenaltyPoints={settings.extraPlayerPenaltyPoints}
            onPickAnotherGame={pickAnotherGame}
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
            answeredCount={answeredTeamIds.length}
            totalTeams={teams.length}
            autoplayMedia={settings.autoplayMedia}
            isFullscreen={progress.isMediaFullscreen}
            mediaReplayToken={progress.mediaReplayToken}
            isMediaPaused={progress.isMediaPaused}
            kahootQuestionEndsAt={kahootQuestionEndsAt}
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
                    hasEntrance
                    {...closestGuessAnswerProps(revealQuestion)}
                  />
                </RevealEntranceConfig>
              </div>
            );
          }
          case 'answer':
            return (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
                <RevealEntranceConfig>
                  <QuestionDisplay
                    question={revealQuestion}
                    mediaTestIdPrefix="reveal"
                    autoplayMedia={settings.autoplayMedia}
                    isFullscreen={progress.isMediaFullscreen}
                    hasRevealEntrance
                  />
                </RevealEntranceConfig>
                {teamsCorrect && teamsCorrect.teamCount > 0 && (
                  <TeamsCorrectCount {...teamsCorrect} />
                )}
              </div>
            );
          default: {
            const unhandled: never = revealQuestion;
            return unhandled;
          }
        }
      }
      case 'ended':
        return (
          <EndedScreen
            leaderboard={leaderboard}
            isFeedbackPromptShown={screen.isFeedbackPromptShown}
          />
        );
      case 'showdown':
        return (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 py-8 text-center">
            <DisplayShowdown
              activeShowdown={screen.showdown}
              step={screen.step}
              isConnected={isConnected}
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

  return (
    <main
      className="flex h-dvh flex-col bg-background text-foreground"
      style={
        { '--display-text-scale': displayTextScale } as React.CSSProperties
      }
    >
      {connectionIssue === 'reconnecting' && (
        <p
          role="status"
          className="fixed right-4 bottom-4 z-50 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Reconnecting…
        </p>
      )}
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
          {renderScreen()}
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
