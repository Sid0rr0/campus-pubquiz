'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import type { QuestionView } from '@campus-pubquiz/types';
import { useGameSocket, type JoinTeamOptions } from '@/app/lib/use-game-socket';
import { RulesContent } from '@/app/components/rules-content';

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';
const TEAM_TOKEN_STORAGE_KEY = 'campus-pubquiz-team-token';
const TEAM_CODE_STORAGE_KEY = 'campus-pubquiz-team-code';
const JOIN_CODE_STORAGE_KEY = 'campus-pubquiz-join-code';

const OPTION_ACCENT_CLASSES = ['text-cyan', 'text-magenta', 'text-green', 'text-orange'];
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}

function storedJoinOptions(): JoinTeamOptions {
  return {
    teamToken: window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY) ?? undefined,
    teamCode: window.localStorage.getItem(TEAM_CODE_STORAGE_KEY) ?? undefined,
    joinCode: window.localStorage.getItem(JOIN_CODE_STORAGE_KEY) ?? undefined,
  };
}

interface AnswerFormProps {
  question: QuestionView;
  initialValue?: string;
  onSubmit: (value: string) => void;
}

function AnswerForm({ question, initialValue = '', onSubmit }: AnswerFormProps) {
  const [value, setValue] = useState(initialValue);

  if (question.type === 'multiple_choice' && question.options) {
    return (
      <div className="flex flex-col gap-2.5">
        {question.options.map((option, index) => {
          const isChosen = option === initialValue;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isChosen}
              onClick={() => onSubmit(option)}
              className={
                isChosen
                  ? 'flex min-h-14 items-center gap-3 rounded-2xl border-2 border-magenta bg-white px-4 text-lg font-bold'
                  : 'flex min-h-14 items-center gap-3 rounded-2xl border-2 border-foreground/30 bg-white px-4 text-lg font-bold'
              }
            >
              <span aria-hidden="true" className={`font-display ${OPTION_ACCENT_CLASSES[index % OPTION_ACCENT_CLASSES.length]}`}>
                {OPTION_LETTERS[index % OPTION_LETTERS.length]}
              </span>
              {option}
              {isChosen && (
                <span aria-hidden="true" className="ml-auto font-display text-magenta">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    onSubmit(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="answer-value" className="text-xs font-extrabold tracking-wide text-foreground/55">
        Your answer
      </label>
      <input
        id="answer-value"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
      />
      <button
        type="submit"
        className="min-h-14 rounded-2xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
      >
        Submit
      </button>
    </form>
  );
}

interface JoinErrorProps {
  message: string;
  onStartOver: () => void;
}

function JoinError({ message, onStartOver }: JoinErrorProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p role="alert" className="text-center font-extrabold text-magenta">
        {message}
      </p>
      <button
        type="button"
        onClick={onStartOver}
        className="min-h-12 rounded-2xl border-2 border-foreground/35 bg-white px-6 font-display"
      >
        Start over
      </button>
    </div>
  );
}

function PlayPageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const [teamName, setTeamName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState(codeFromUrl);
  const [teamCodeInput, setTeamCodeInput] = useState('');
  // null = follow the question currently shown on the big screen.
  const [browsedQuestionId, setBrowsedQuestionId] = useState<number | null>(null);
  const {
    snapshot,
    team,
    connectionError,
    joinTeam,
    submitAnswer,
    myAnswers = {},
  } = useGameSocket('players');
  const gameStatus = snapshot?.progress.status;
  const currentQuestionId = snapshot?.currentQuestion?.id ?? null;

  useEffect(() => {
    // Snap back to the newest question whenever the quiz master reveals one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowsedQuestionId(null);
  }, [currentQuestionId]);

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored team name can only
    // be read after mount - this is the "synchronize with an external system"
    // case React's own docs carve out as a legitimate effect.
    const storedName = window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(storedName);
    if (storedName) {
      joinTeam(storedName, storedJoinOptions());
    }
  }, [joinTeam]);

  useEffect(() => {
    if (team) {
      window.localStorage.setItem(TEAM_TOKEN_STORAGE_KEY, team.teamToken);
      window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, team.teamCode);
    }
  }, [team]);

  useEffect(() => {
    // Back in the lobby means the admin may have started a fresh game session,
    // which invalidates the team registration. Re-joining is idempotent for
    // the same session and re-registers the team under a new one.
    if (gameStatus !== 'lobby' || !teamName) return;
    joinTeam(teamName, storedJoinOptions());
  }, [gameStatus, teamName, joinTeam]);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nameInput.trim();
    const normalizedCode = normalizeJoinCode(codeInput);
    if (!trimmedName || !normalizedCode) return;
    window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, trimmedName);
    window.localStorage.setItem(JOIN_CODE_STORAGE_KEY, normalizedCode);
    setTeamName(trimmedName);
    joinTeam(trimmedName, {
      joinCode: normalizedCode,
      teamCode: teamCodeInput.trim() || undefined,
    });
  }

  function handleStartOver() {
    window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY);
    window.localStorage.removeItem(TEAM_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(TEAM_CODE_STORAGE_KEY);
    window.localStorage.removeItem(JOIN_CODE_STORAGE_KEY);
    setTeamName(null);
    setNameInput('');
    setCodeInput(codeFromUrl);
    setTeamCodeInput('');
  }

  if (!teamName) {
    return (
      <main className="flex min-h-screen flex-col justify-center gap-4 bg-background px-7 py-10 text-foreground">
        <h1 className="text-center font-display text-3xl text-magenta">🍺 Join the quiz</h1>
        <p className="-mt-2 text-center text-sm text-foreground/65">Grab a table, pick a name</p>
        <form onSubmit={handleJoin} className="mt-3 flex flex-col gap-2">
          <label htmlFor="team-name" className="text-xs font-extrabold tracking-wide text-foreground/55">
            Team name
          </label>
          <input
            id="team-name"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
          />
          <label htmlFor="game-code" className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55">
            Game code
          </label>
          <input
            id="game-code"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. ABC234"
            className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
          />
          <label htmlFor="team-code" className="mt-2 text-xs font-extrabold tracking-wide text-foreground/55">
            Team code (only if this team has played before)
          </label>
          <input
            id="team-code"
            value={teamCodeInput}
            onChange={(event) => setTeamCodeInput(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. QZX456"
            className="min-h-14 rounded-2xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold uppercase tracking-widest"
          />
          <button
            type="submit"
            className="mt-2 min-h-14 rounded-2xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
          >
            Join the quiz
          </button>
        </form>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">Playing as {teamName}</p>
        {connectionError && !team ? (
          <JoinError message={connectionError} onStartOver={handleStartOver} />
        ) : (
          <p className="font-display text-xl">Connecting…</p>
        )}
      </main>
    );
  }

  const {
    progress,
    currentQuestion,
    blockQuestions = [],
    quizStructure = { blockCount: 0, topicsPerBlock: null },
    roundTitle = '',
  } = snapshot;
  const selectedQuestion =
    blockQuestions.find((question) => question.id === browsedQuestionId) ?? currentQuestion;

  return (
    <main className="flex min-h-screen flex-col bg-background px-5 py-5 text-foreground">
      <p className="mb-1 text-sm font-extrabold tracking-wide text-foreground/55">Playing as {teamName}</p>
      {team && (
        <p className="mb-4 text-xs text-foreground/45">
          Team code: {team.teamCode} — save it to play as this team another night.
        </p>
      )}
      {connectionError && !team && (
        <div className="mb-4">
          <JoinError message={connectionError} onStartOver={handleStartOver} />
        </div>
      )}
      {progress.isLeaderboardVisible && (
        <h1 className="text-center font-display text-3xl text-magenta">Leaderboard</h1>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <div className="mt-16 flex flex-col items-center gap-3">
          <h1 className="text-center font-display text-2xl">Waiting for the quiz to start…</h1>
          <a href="/rules" className="text-sm font-extrabold text-cyan underline">
            Read the rules
          </a>
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'rules' && (
        <div className="mt-6">
          <RulesContent quizStructure={quizStructure} />
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'round_intro' && (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-extrabold tracking-wide text-foreground/55">
            👀 Look at the screen
          </p>
          <h1 className="font-display text-2xl">{roundTitle}</h1>
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'question_open' && selectedQuestion && (
        <div className="flex flex-col gap-6">
          {blockQuestions.length > 1 && (
            <nav aria-label="Open questions" className="flex flex-wrap gap-2">
              {blockQuestions.map((question, index) => {
                const isAnswered = question.id in myAnswers;
                const isSelected = question.id === selectedQuestion.id;
                return (
                  <button
                    key={question.id}
                    type="button"
                    aria-label={`Question ${index + 1}${isAnswered ? ' (answered)' : ''}`}
                    onClick={() => setBrowsedQuestionId(question.id)}
                    className={
                      isSelected
                        ? 'flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-magenta bg-white font-extrabold text-magenta'
                        : 'flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 border-foreground/30 bg-white font-extrabold'
                    }
                  >
                    {index + 1}
                    {isAnswered && <span aria-hidden="true" className="ml-1 text-green">✓</span>}
                  </button>
                );
              })}
            </nav>
          )}
          <h1 className="text-balance font-display text-2xl leading-tight">{selectedQuestion.prompt}</h1>
          {(selectedQuestion.type === 'picture' || selectedQuestion.type === 'audio') && (
            <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
          )}
          {team && (
            <AnswerForm
              key={selectedQuestion.id}
              question={selectedQuestion}
              initialValue={myAnswers[selectedQuestion.id] ?? ''}
              onSubmit={(value) => submitAnswer(selectedQuestion.id, team.teamId, value)}
            />
          )}
        </div>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'break' && (
        <h1 className="mt-16 text-center font-display text-2xl">
          Answers are locked — grading in progress…
        </h1>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'reveal' && (
        <h1 className="mt-16 text-center font-display text-2xl">Revealing answers…</h1>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'ended' && (
        <h1 className="mt-16 text-center font-display text-2xl">Quiz complete!</h1>
      )}
    </main>
  );
}

export default function PlayPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <PlayPageContent />
    </Suspense>
  );
}
