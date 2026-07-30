'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import type { TeamView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { RulesContent } from '@/app/components/rules-content';

const QR_SIZE_PX = 220;

const SCATTER_TEXT_CLASSES = ['text-cyan', 'text-magenta', 'text-green', 'text-orange'];
// Keep scattered names inside the visible lobby area (percent of container).
const SCATTER_LEFT_RANGE = { min: 4, span: 70 };
const SCATTER_TOP_RANGE = { min: 8, span: 76 };
const SCATTER_TILT_MAX_DEG = 8;

// Deterministic pseudo-random in [0, 1) so each team keeps its spot across
// re-renders and reconnects instead of jumping around the screen.
function hashToUnit(seed: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

interface ScatteredTeamNamesProps {
  teams: TeamView[];
}

function ScatteredTeamNames({ teams }: ScatteredTeamNamesProps) {
  return (
    <div aria-label="Connected teams" className="pointer-events-none absolute inset-0">
      {teams.map((team, index) => (
        <span
          key={team.teamId}
          style={{
            left: `${SCATTER_LEFT_RANGE.min + hashToUnit(String(team.teamId), 1) * SCATTER_LEFT_RANGE.span}%`,
            top: `${SCATTER_TOP_RANGE.min + hashToUnit(String(team.teamId), 2) * SCATTER_TOP_RANGE.span}%`,
            transform: `rotate(${(hashToUnit(String(team.teamId), 3) * 2 - 1) * SCATTER_TILT_MAX_DEG}deg)`,
          }}
          className={`absolute font-display text-2xl ${SCATTER_TEXT_CLASSES[index % SCATTER_TEXT_CLASSES.length]}`}
        >
          {team.teamName}
        </span>
      ))}
    </div>
  );
}

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i;

// Neither media_url nor answer_media_url is tied to the question's `type`
// (e.g. a free_text question can carry a photo or reveal one), so image vs.
// audio is inferred from the URL's file extension instead.
function isAudioUrl(url: string): boolean {
  return AUDIO_EXTENSION_PATTERN.test(url);
}

const OPTION_ACCENT_CLASSES = ['text-cyan', 'text-magenta', 'text-green', 'text-orange'];
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

interface QuestionDisplayProps {
  prompt: string;
  mediaUrl?: string;
  options?: string[];
  /** When set (reveal only), highlights the matching option and shows an answer line. */
  correctAnswer?: string;
  /** Shown alongside the answer during reveal only — independent of the question's own media. */
  answerMediaUrl?: string;
  mediaTestIdPrefix: string;
}

// Shared by question_open and reveal so the big screen shows each question
// the same way it was originally asked, just with the answer added back in.
function QuestionDisplay({
  prompt,
  mediaUrl,
  options,
  correctAnswer,
  answerMediaUrl,
  mediaTestIdPrefix,
}: QuestionDisplayProps) {
  // On reveal, answer_media_url (when set) replaces the question's own
  // media_url rather than showing both — e.g. a picture round's image gives
  // way to whatever the answer_media_url shows instead.
  const isRevealing = correctAnswer !== undefined;
  const questionMediaUrl = isRevealing && answerMediaUrl ? undefined : mediaUrl;

  return (
    <>
      <h1 className="text-balance font-display text-4xl leading-snug">{prompt}</h1>
      {questionMediaUrl && !isAudioUrl(questionMediaUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
        <img
          data-testid={`${mediaTestIdPrefix}-image`}
          src={questionMediaUrl}
          alt=""
          className="max-h-64 rounded-xl"
        />
      )}
      {questionMediaUrl && isAudioUrl(questionMediaUrl) && (
        <audio
          data-testid={`${mediaTestIdPrefix}-audio`}
          src={questionMediaUrl}
          controls
          autoPlay
        />
      )}
      {options && (
        <ul className="grid w-full max-w-3xl grid-cols-2 gap-4">
          {options.map((option, index) => {
            const isCorrect = correctAnswer !== undefined && option === correctAnswer;
            return (
              <li
                key={option}
                className={`flex items-center gap-3 rounded-xl border-2 bg-white px-5 py-3 text-left text-xl font-bold ${
                  isCorrect ? 'border-green' : 'border-foreground/30'
                }`}
              >
                <span
                  className={`font-display ${
                    isCorrect
                      ? 'text-green'
                      : OPTION_ACCENT_CLASSES[index % OPTION_ACCENT_CLASSES.length]
                  }`}
                >
                  {OPTION_LETTERS[index % OPTION_LETTERS.length]}
                </span>
                <span className="text-foreground">{option}</span>
                {isCorrect && (
                  <span aria-hidden="true" className="ml-auto text-green">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isRevealing && (
        <p className="font-display text-lg text-green">
          <span className="font-body text-sm font-extrabold text-foreground/55">ANSWER </span>
          {correctAnswer}
        </p>
      )}
      {isRevealing && answerMediaUrl && !isAudioUrl(answerMediaUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
        <img
          data-testid={`${mediaTestIdPrefix}-answer-image`}
          src={answerMediaUrl}
          alt=""
          className="max-h-64 rounded-xl"
        />
      )}
      {isRevealing && answerMediaUrl && isAudioUrl(answerMediaUrl) && (
        <audio
          data-testid={`${mediaTestIdPrefix}-answer-audio`}
          src={answerMediaUrl}
          controls
          autoPlay
        />
      )}
    </>
  );
}

const LOCK_RING_RADIUS = 45;
const LOCK_RING_CIRCUMFERENCE = 2 * Math.PI * LOCK_RING_RADIUS;

interface QuestionLockCountdownProps {
  /** Epoch-ms deadline when the question auto-locks. */
  lockAt: number;
}

// Ring duration is derived from the remaining time at mount, not a hardcoded
// 60s, so a display that reconnects mid-countdown resumes at the correct
// fraction instead of restarting a full sweep.
function QuestionLockCountdown({ lockAt }: QuestionLockCountdownProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    Math.max(0, Math.ceil((lockAt - Date.now()) / 1000)),
  );
  // Captured once at mount so the ring's animation duration reflects however
  // much time was actually left (e.g. after a reconnect mid-countdown),
  // rather than recomputing (and therefore restarting) on every re-render.
  const [remainingMs] = useState(() => Math.max(0, lockAt - Date.now()));

  useEffect(() => {
    const tick = () =>
      setSecondsRemaining(Math.max(0, Math.ceil((lockAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lockAt]);

  return (
    <div
      data-testid="question-lock-countdown"
      className="relative flex h-24 w-24 items-center justify-center"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={LOCK_RING_RADIUS}
          strokeWidth="8"
          className="fill-none stroke-foreground/15"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={LOCK_RING_RADIUS}
          strokeWidth="8"
          strokeLinecap="round"
          className="fill-none stroke-magenta"
          strokeDasharray={LOCK_RING_CIRCUMFERENCE}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: LOCK_RING_CIRCUMFERENCE }}
          transition={{ duration: remainingMs / 1000, ease: 'linear' }}
        />
      </svg>
      <span className="absolute font-display text-2xl text-foreground">
        {secondsRemaining}
      </span>
    </div>
  );
}

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
    blockQuestions = [],
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
        <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-16 text-center">
          <ScatteredTeamNames teams={teams} />
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
      {!progress.isLeaderboardVisible &&
        progress.status === 'question_open' &&
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
              <QuestionDisplay
                prompt={currentQuestion.prompt}
                mediaUrl={currentQuestion.mediaUrl}
                options={currentQuestion.options}
                mediaTestIdPrefix="question"
              />
              {teams.length > 0 && (
                <p className="font-extrabold tracking-wide text-foreground/55">
                  {answeredTeamIds.length} OF {teams.length} TEAMS ANSWERED
                </p>
              )}
            </div>
          </>
        )}
      {!progress.isLeaderboardVisible && progress.status === 'locking' && questionLockAt !== null && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-16 text-center">
          <h1 className="font-display text-4xl">Time&apos;s almost up!</h1>
          <QuestionLockCountdown key={questionLockAt} lockAt={questionLockAt} />
        </div>
      )}
      {!progress.isLeaderboardVisible &&
        progress.status === 'break' &&
        (blockQuestions[progress.revealIndex] ? (
          <>
            <div className="flex items-center justify-between border-b-2 border-dashed border-foreground/30 px-8 py-4">
              <div className="font-display text-lg text-magenta">🍺 Trivia Night</div>
              <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
                <span className="text-foreground/55">GRADING</span>
                <span className="rounded-lg bg-foreground px-3 py-1 text-background">
                  ROUND {blockQuestions[progress.revealIndex].roundNumber} · QUESTION{' '}
                  {blockQuestions[progress.revealIndex].questionNumberInRound}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
              <QuestionDisplay
                prompt={blockQuestions[progress.revealIndex].prompt}
                mediaUrl={blockQuestions[progress.revealIndex].mediaUrl}
                options={blockQuestions[progress.revealIndex].options}
                mediaTestIdPrefix="grading"
              />
              <p className="font-extrabold tracking-wide text-foreground/55">
                Grading in progress…
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-16 text-center">
            <h1 className="font-display text-4xl">Grading in progress…</h1>
          </div>
        ))}
      {!progress.isLeaderboardVisible &&
        progress.status === 'reveal' &&
        revealQuestions[progress.revealIndex] && (
          <>
            <div className="flex items-center justify-between border-b-2 border-dashed border-foreground/30 px-8 py-4">
              <div className="font-display text-lg text-magenta">🍺 Trivia Night</div>
              <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
                <span className="text-foreground/55">REVEALING ANSWERS</span>
                <span className="rounded-lg bg-foreground px-3 py-1 text-background">
                  ROUND {revealQuestions[progress.revealIndex].roundNumber} · QUESTION{' '}
                  {revealQuestions[progress.revealIndex].questionNumberInRound}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-8 px-16 py-8 text-center">
              <QuestionDisplay
                prompt={revealQuestions[progress.revealIndex].prompt}
                mediaUrl={revealQuestions[progress.revealIndex].mediaUrl}
                options={revealQuestions[progress.revealIndex].options}
                correctAnswer={revealQuestions[progress.revealIndex].answer}
                answerMediaUrl={revealQuestions[progress.revealIndex].answerMediaUrl}
                mediaTestIdPrefix="reveal"
              />
            </div>
          </>
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
