'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { RulesContent } from '@/app/components/rules-content';
import { BreakIntroScreen } from '@/app/display/break-intro-screen';
import { LobbyScreen } from '@/app/display/lobby-screen';
import { QuestionLockCountdown } from '@/app/display/question-lock-countdown';
import { QuestionOpenScreen } from '@/app/display/question-open-screen';
import { RevealIntroScreen } from '@/app/display/reveal-intro-screen';
import { RevealScreen } from '@/app/display/reveal-screen';

function DisplayPageContent() {
  const searchParams = useSearchParams();
  const { snapshot } = useGameSocket('display');
  // The query parameter pins the display to a specific game session's code
  // (e.g. a pre-printed URL); otherwise the live snapshot provides it.
  const joinCode = searchParams.get('code') ?? snapshot?.joinCode;

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

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
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
        <LobbyScreen teams={teams} joinCode={joinCode} />
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
          roundNumber={progress.roundIndex + 1}
          questionNumber={progress.questionIndex + 1}
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
      {!progress.isLeaderboardVisible &&
        progress.status === 'reveal_intro' &&
        revealQuestions[progress.revealIndex] && (
          <RevealIntroScreen
            roundNumber={revealQuestions[progress.revealIndex].roundNumber}
            roundTitle={revealQuestions[progress.revealIndex].roundTitle}
          />
        )}
      {!progress.isLeaderboardVisible &&
        progress.status === 'reveal' &&
        revealQuestions[progress.revealIndex] && (
          <RevealScreen revealQuestion={revealQuestions[progress.revealIndex]} />
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
