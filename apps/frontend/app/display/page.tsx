'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';

const QR_SIZE_PX = 220;

const OPTION_ACCENT_CLASSES = [
  'border-cyan text-cyan',
  'border-magenta text-magenta',
  'border-green text-green',
  'border-orange text-orange',
];
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

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

  const { progress, currentQuestion, leaderboard = [] } = snapshot;

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {progress.isLeaderboardVisible && (
        <div className="flex flex-1 flex-col justify-center gap-6 px-24 py-10">
          <h1 className="text-center font-display text-4xl">
            <span className="text-magenta">Leaderboard</span>{' '}
            <span className="font-body text-lg font-extrabold text-foreground/55">
              AFTER ROUND {progress.roundIndex + 1}
            </span>
          </h1>
          <Leaderboard entries={leaderboard} />
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 text-center">
          <h1 className="font-display text-4xl">Waiting for the quiz to start…</h1>
          {joinCode && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl border-2 border-foreground/30 bg-white p-5">
                <QRCodeSVG
                  value={`${window.location.origin}/play?code=${joinCode}`}
                  title="Join QR code"
                  size={QR_SIZE_PX}
                />
              </div>
              <p className="text-sm font-extrabold tracking-wide text-foreground/55">
                SCAN TO JOIN — OR GO TO /PLAY AND ENTER THE CODE
              </p>
              <p className="font-display text-4xl tracking-[0.3em] text-magenta">{joinCode}</p>
            </div>
          )}
        </div>
      )}
      {!progress.isLeaderboardVisible &&
        (progress.status === 'question_open' || progress.status === 'locked') &&
        currentQuestion && (
          <>
            <div className="flex items-center justify-between border-b-2 border-dashed border-foreground/30 px-8 py-4">
              <div className="font-display text-lg text-magenta">🍺 Trivia Night</div>
              <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
                <span className="text-foreground/55">ROUND {progress.roundIndex + 1}</span>
                <span className="rounded-lg bg-foreground px-3 py-1 text-background">
                  QUESTION {progress.questionIndex + 1}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
              <h1 className="text-balance font-display text-4xl leading-snug">{currentQuestion.prompt}</h1>
              {currentQuestion.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
                <img src={currentQuestion.mediaUrl} alt="" className="max-h-64 rounded-xl" />
              )}
              {currentQuestion.options && (
                <ul className="grid w-full max-w-3xl grid-cols-2 gap-4">
                  {currentQuestion.options.map((option, index) => (
                    <li
                      key={option}
                      className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-left text-xl font-bold ${OPTION_ACCENT_CLASSES[index % OPTION_ACCENT_CLASSES.length]}`}
                    >
                      <span className="font-display">{OPTION_LETTERS[index % OPTION_LETTERS.length]}</span>
                      <span className="text-foreground">{option}</span>
                    </li>
                  ))}
                </ul>
              )}
              {progress.status === 'locked' && (
                <p className="font-extrabold tracking-wide text-magenta">Answers locked</p>
              )}
            </div>
          </>
        )}
      {!progress.isLeaderboardVisible && progress.status === 'break' && (
        <div className="flex flex-1 items-center justify-center px-16 text-center">
          <h1 className="font-display text-4xl">Grading in progress…</h1>
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'reveal' && (
        <div className="flex flex-1 items-center justify-center px-16 text-center">
          <h1 className="font-display text-4xl">Revealing answers…</h1>
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
