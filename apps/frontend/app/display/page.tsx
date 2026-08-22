'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  DEFAULT_SESSION_SETTINGS,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type GameProgress,
} from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { ClosestGuessRevealScreen } from '@/app/components/closest-guess-reveal-screen';
import { Leaderboard } from '@/app/components/leaderboard';
import { RulesContent } from '@/app/components/rules-content';
import { BreakIntroScreen } from '@/app/display/break-intro-screen';
import { BreakReviewScreen } from '@/app/display/break-review-screen';
import { BreakRoundIntroScreen } from '@/app/display/break-round-intro-screen';
import { DisplaySessionPicker } from '@/app/display/display-session-picker';
import { LobbyScreen } from '@/app/display/lobby-screen';
import { QuestionDisplay } from '@/app/display/question-display';
import { QuestionLockCountdown } from '@/app/display/question-lock-countdown';
import { QuestionOpenScreen } from '@/app/display/question-open-screen';
import { RevealIntroScreen } from '@/app/display/reveal-intro-screen';
import { TriviaHeader } from '@/app/display/trivia-header';

interface HeaderContent {
  label?: string;
  badge?: string;
}

/**
 * Round/question badge for the header — only for statuses whose own screen
 * has no other way to show that context (question_open/locking/break/reveal).
 * round_intro and reveal_intro already show "ROUND N" in their own big
 * centered card, so the header stays badge-less there to avoid showing the
 * same line twice.
 */
function getHeaderContent(
  progress: GameProgress,
  breakQuestion:
    | Pick<BlockQuestionView, 'roundNumber' | 'questionNumberInRound'>
    | undefined,
  revealRoundNumber: number | undefined,
  revealQuestionNumber: number | undefined,
): HeaderContent {
  switch (progress.status) {
    case 'question_open':
    case 'locking':
      return {
        label: `ROUND ${progress.roundIndex + 1}`,
        badge: `QUESTION ${progress.questionIndex + 1}`,
      };
    case 'break':
      if (breakQuestion === undefined) return {};
      return {
        label: `ROUND ${breakQuestion.roundNumber}`,
        badge: `QUESTION ${breakQuestion.questionNumberInRound} (BREAK)`,
      };
    case 'reveal':
      if (revealRoundNumber === undefined || revealQuestionNumber === undefined)
        return {};
      return {
        label: `ROUND ${revealRoundNumber}`,
        badge: `REVEALING ANSWERS · QUESTION ${revealQuestionNumber}`,
      };
    default:
      return {};
  }
}

/**
 * Identifies the visually distinct screen currently on-air, so AnimatePresence
 * only re-triggers the transition when what's shown actually changes (not on
 * every snapshot broadcast for the same screen, e.g. an answer count ticking
 * up during question_open).
 */
function getScreenKey(
  progress: GameProgress,
  revealQuestion:
    | Pick<BlockRevealQuestionView, 'roundNumber' | 'questionNumberInRound'>
    | undefined,
  closestGuessRevealStep: number,
): string {
  if (progress.isLeaderboardVisible) return 'leaderboard';

  switch (progress.status) {
    case 'question_open':
    case 'locking':
      return `${progress.status}-${progress.roundIndex}-${progress.questionIndex}`;
    case 'round_intro':
      return `round_intro-${progress.roundIndex}`;
    case 'break_intro':
      return `break_intro-${progress.roundIndex}`;
    case 'break':
      return `break-${progress.roundIndex}-${progress.revealIndex}`;
    case 'break_round_intro':
      return `break_round_intro-${progress.revealIndex}`;
    case 'reveal_intro':
      return `reveal_intro-${revealQuestion?.roundNumber ?? 0}-${revealQuestion?.questionNumberInRound ?? 0}`;
    case 'reveal':
      return `reveal-${revealQuestion?.roundNumber ?? 0}-${revealQuestion?.questionNumberInRound ?? 0}-${closestGuessRevealStep}`;
    default:
      return progress.status;
  }
}

function DisplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The query parameter pins this connection to a specific game session's
  // code (e.g. a pre-printed URL or a picked session below). No fallback to
  // an implicit "default" session — once more than one game can run at
  // once that would silently point the screen at the wrong game.
  const codeFromUrl = searchParams.get('code') ?? undefined;
  const { snapshot, connectionError } = useGameSocket(
    'display',
    Boolean(codeFromUrl),
    codeFromUrl,
  );

  // An unknown/stale code (e.g. a pre-printed QR for a session that's since
  // ended) still needs the picker's error message on screen, so this only
  // strips the bad ?code= from the address bar rather than navigating away —
  // connectionError itself persists past the redirect (see use-game-socket's
  // early return when `enabled` is false).
  useEffect(() => {
    if (codeFromUrl && connectionError) {
      router.replace('/display');
    }
  }, [codeFromUrl, connectionError, router]);

  if (!codeFromUrl || connectionError) {
    return (
      <DisplaySessionPicker
        connectionError={connectionError}
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
    quizStructure = {
      blockCount: 0,
      topicsPerBlock: null,
      breakRoundNumbers: [],
      minQuestionsPerTopic: 0,
      maxQuestionsPerTopic: 0,
    },
    leaderboard = [],
    leaderboardRevealCount = 0,
    teams = [],
    answeredTeamIds = [],
    blockQuestions = [],
    revealQuestions = [],
    roundTitle = '',
    questionLockAt = null,
    closestGuessRevealStep = 0,
    settings = DEFAULT_SESSION_SETTINGS,
  } = snapshot;

  const revealQuestion = revealQuestions[progress.revealIndex];
  // The specific block question under review — every position shows its own
  // content (including the block's last, just-locked question), so Previous
  // steps through Q5, Q4, Q3… one at a time with nothing skipped.
  const breakReviewQuestion = blockQuestions[progress.revealIndex];
  // The round whose title is paused on — looked up the same way as
  // revealQuestion above, since progress.roundIndex stays pinned to the
  // block's last round throughout break, not whichever round is on screen.
  const breakRoundIntroQuestion = blockQuestions[progress.revealIndex];
  const headerContent = getHeaderContent(
    progress,
    breakReviewQuestion,
    revealQuestion?.roundNumber,
    revealQuestion?.questionNumberInRound,
  );

  const screenKey = getScreenKey(
    progress,
    revealQuestion,
    closestGuessRevealStep,
  );

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <TriviaHeader label={headerContent.label} badge={headerContent.badge} />
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex flex-1 flex-col"
        >
          {progress.isLeaderboardVisible ? (
            <div className="flex flex-1 flex-col justify-center gap-6 px-24 py-10">
              <h1 className="text-center font-display text-4xl">
                <span className="text-magenta">Leaderboard</span>
              </h1>
              <Leaderboard
                entries={leaderboard}
                revealCount={leaderboardRevealCount}
              />
            </div>
          ) : (
            <>
              {progress.status === 'lobby' && (
                <LobbyScreen teams={teams} joinCode={codeFromUrl} />
              )}
              {progress.status === 'rules' && (
                <div className="flex flex-1 items-center justify-center px-16 py-10">
                  <RulesContent
                    quizStructure={quizStructure}
                    rules={settings.rules}
                    enabledBonusCategories={settings.enabledBonusCategories}
                  />
                </div>
              )}
              {progress.status === 'round_intro' && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
                  <p className="text-sm font-extrabold tracking-wide text-foreground/55">
                    ROUND {progress.roundIndex + 1}
                  </p>
                  <h1 className="text-balance font-display text-6xl text-magenta">
                    {roundTitle}
                  </h1>
                </div>
              )}
              {progress.status === 'question_open' && currentQuestion && (
                <QuestionOpenScreen
                  question={currentQuestion}
                  answeredCount={answeredTeamIds.length}
                  totalTeams={teams.length}
                  autoplayMedia={settings.autoplayMedia}
                />
              )}
              {progress.status === 'locking' && questionLockAt !== null && (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
                  <h1 className="font-display text-4xl">
                    Time&apos;s almost up!
                  </h1>
                  <QuestionLockCountdown
                    key={questionLockAt}
                    lockAt={questionLockAt}
                  />
                </div>
              )}
              {progress.status === 'break_intro' && (
                <BreakIntroScreen roundNumber={progress.roundIndex + 1} />
              )}
              {progress.status === 'break' &&
                (breakReviewQuestion ? (
                  <BreakReviewScreen
                    question={breakReviewQuestion}
                    autoplayMedia={settings.autoplayMedia}
                  />
                ) : (
                  <BreakIntroScreen roundNumber={progress.roundIndex + 1} />
                ))}
              {progress.status === 'break_round_intro' &&
                breakRoundIntroQuestion && (
                  <BreakRoundIntroScreen
                    roundNumber={breakRoundIntroQuestion.roundNumber}
                    roundTitle={breakRoundIntroQuestion.roundTitle}
                  />
                )}
              {progress.status === 'reveal_intro' && revealQuestion && (
                <RevealIntroScreen
                  roundNumber={revealQuestion.roundNumber}
                  roundTitle={revealQuestion.roundTitle}
                />
              )}
              {progress.status === 'reveal' &&
                revealQuestion &&
                (revealQuestion.type === 'closest_guess' &&
                revealQuestion.closestGuess ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
                    <ClosestGuessRevealScreen
                      prompt={revealQuestion.prompt}
                      step={closestGuessRevealStep}
                      correctAnswer={revealQuestion.answer}
                      answerMediaUrl={revealQuestion.answerMediaUrl}
                      closestGuess={revealQuestion.closestGuess}
                      mediaTestIdPrefix="reveal"
                      autoplayMedia={settings.autoplayMedia}
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
                    <QuestionDisplay
                      type={revealQuestion.type}
                      prompt={revealQuestion.prompt}
                      mediaUrl={revealQuestion.mediaUrl}
                      mediaStartSeconds={revealQuestion.mediaStartSeconds}
                      mediaEndSeconds={revealQuestion.mediaEndSeconds}
                      options={revealQuestion.options}
                      matchTargets={revealQuestion.matchTargets}
                      correctAnswer={revealQuestion.answer}
                      answerMediaUrl={revealQuestion.answerMediaUrl}
                      mediaTestIdPrefix="reveal"
                      autoplayMedia={settings.autoplayMedia}
                    />
                  </div>
                ))}
              {progress.status === 'ended' && (
                <div className="flex flex-1 items-center justify-center px-16 text-center">
                  <h1 className="font-display text-4xl">Quiz complete!</h1>
                </div>
              )}
            </>
          )}
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
