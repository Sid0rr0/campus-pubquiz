'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import type { GameProgress } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { RulesContent } from '@/app/components/rules-content';
import { BreakIntroScreen } from '@/app/display/break-intro-screen';
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
 * has no other way to show that context (question_open/locking/reveal).
 * round_intro, break_intro/break and reveal_intro already show "ROUND N" in
 * their own big centered card, so the header stays badge-less there to avoid
 * showing the same line twice.
 */
function getHeaderContent(
  progress: GameProgress,
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
    case 'reveal':
      if (revealRoundNumber === undefined || revealQuestionNumber === undefined) return {};
      return {
        label: `ROUND ${revealRoundNumber}`,
        badge: `REVEALING ANSWERS · QUESTION ${revealQuestionNumber}`,
      };
    default:
      return {};
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
  const { snapshot, connectionError } = useGameSocket('display', Boolean(codeFromUrl), codeFromUrl);

  if (!codeFromUrl || connectionError) {
    return (
      <DisplaySessionPicker
        connectionError={connectionError}
        onSelectSession={(joinCode) => router.replace(`/display?code=${joinCode}`)}
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
    quizStructure = { blockCount: 0, topicsPerBlock: null },
    leaderboard = [],
    leaderboardRevealCount = 0,
    teams = [],
    answeredTeamIds = [],
    revealQuestions = [],
    roundTitle = '',
    questionLockAt = null,
  } = snapshot;

  const revealQuestion = revealQuestions[progress.revealIndex];
  const headerContent = getHeaderContent(
    progress,
    revealQuestion?.roundNumber,
    revealQuestion?.questionNumberInRound,
  );

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <TriviaHeader label={headerContent.label} badge={headerContent.badge} />
      {progress.isLeaderboardVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-1 flex-col justify-center gap-6 px-24 py-10"
        >
          <h1 className="text-center font-display text-4xl">
            <span className="text-magenta">Leaderboard</span>

          </h1>
          <Leaderboard entries={leaderboard} revealCount={leaderboardRevealCount} />
        </motion.div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <LobbyScreen teams={teams} joinCode={codeFromUrl} />
      )}
      {!progress.isLeaderboardVisible && progress.status === 'rules' && (
        <div className="flex flex-1 items-center justify-center px-16 py-10">
          <RulesContent quizStructure={quizStructure} />
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'round_intro' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-16 text-center">
          <p className="text-sm font-extrabold tracking-wide text-foreground/55">
            ROUND {progress.roundIndex + 1}
          </p>
          <h1 className="text-balance font-display text-6xl text-magenta">{roundTitle}</h1>
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'question_open' && currentQuestion && (
        <QuestionOpenScreen
          question={currentQuestion}
          answeredCount={answeredTeamIds.length}
          totalTeams={teams.length}
        />
      )}
      {!progress.isLeaderboardVisible && progress.status === 'locking' && questionLockAt !== null && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
          <h1 className="font-display text-4xl">Time&apos;s almost up!</h1>
          <QuestionLockCountdown key={questionLockAt} lockAt={questionLockAt} />
        </div>
      )}
      {!progress.isLeaderboardVisible &&
        (progress.status === 'break_intro' || progress.status === 'break') && (
          <BreakIntroScreen roundNumber={progress.roundIndex + 1} />
        )}
      {!progress.isLeaderboardVisible && progress.status === 'reveal_intro' && revealQuestion && (
        <RevealIntroScreen
          roundNumber={revealQuestion.roundNumber}
          roundTitle={revealQuestion.roundTitle}
        />
      )}
      {!progress.isLeaderboardVisible && progress.status === 'reveal' && revealQuestion && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
          <QuestionDisplay
            prompt={revealQuestion.prompt}
            mediaUrl={revealQuestion.mediaUrl}
            options={revealQuestion.options}
            correctAnswer={revealQuestion.answer}
            answerMediaUrl={revealQuestion.answerMediaUrl}
            mediaTestIdPrefix="reveal"
          />
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'ended' && (
        <div className="flex flex-1 items-center justify-center px-16 text-center">
          <h1 className="font-display text-4xl">Quiz complete!</h1>
        </div>
      )}
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
