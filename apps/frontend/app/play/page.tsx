'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { QuestionView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';
const TEAM_TOKEN_STORAGE_KEY = 'campus-pubquiz-team-token';

const OPTION_ACCENT_CLASSES = ['text-cyan', 'text-magenta', 'text-green', 'text-orange'];
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

interface AnswerFormProps {
  question: QuestionView;
  onSubmit: (value: string) => void;
}

function AnswerForm({ question, onSubmit }: AnswerFormProps) {
  const [value, setValue] = useState('');

  if (question.type === 'multiple_choice' && question.options) {
    return (
      <div className="flex flex-col gap-2.5">
        {question.options.map((option, index) => (
          <button
            key={option}
            type="button"
            onClick={() => onSubmit(option)}
            className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-foreground/30 bg-white px-4 text-lg font-bold"
          >
            <span aria-hidden="true" className={`font-display ${OPTION_ACCENT_CLASSES[index % OPTION_ACCENT_CLASSES.length]}`}>
              {OPTION_LETTERS[index % OPTION_LETTERS.length]}
            </span>
            {option}
          </button>
        ))}
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

export default function PlayPage() {
  const [teamName, setTeamName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const { snapshot, team, joinTeam, submitAnswer } = useGameSocket('players');

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored team name can only
    // be read after mount - this is the "synchronize with an external system"
    // case React's own docs carve out as a legitimate effect.
    const storedName = window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(storedName);
    if (storedName) {
      const storedToken = window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY);
      joinTeam(storedName, storedToken ?? undefined);
    }
  }, [joinTeam]);

  useEffect(() => {
    if (team) {
      window.localStorage.setItem(TEAM_TOKEN_STORAGE_KEY, team.teamToken);
    }
  }, [team]);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, trimmed);
    setTeamName(trimmed);
    joinTeam(trimmed, undefined);
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
        <p className="font-display text-xl">Connecting…</p>
      </main>
    );
  }

  const { progress, currentQuestion } = snapshot;

  return (
    <main className="flex min-h-screen flex-col bg-background px-5 py-5 text-foreground">
      <p className="mb-4 text-sm font-extrabold tracking-wide text-foreground/55">Playing as {teamName}</p>
      {progress.isLeaderboardVisible && (
        <h1 className="text-center font-display text-3xl text-magenta">Leaderboard</h1>
      )}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <h1 className="mt-16 text-center font-display text-2xl">Waiting for the quiz to start…</h1>
      )}
      {!progress.isLeaderboardVisible &&
        (progress.status === 'question_open' || progress.status === 'locked') &&
        currentQuestion && (
          <div className="flex flex-col gap-6">
            <h1 className="text-balance font-display text-2xl leading-tight">{currentQuestion.prompt}</h1>
            {progress.status === 'locked' && <p className="font-extrabold text-magenta">Answers locked</p>}
            {progress.status === 'question_open' && team && (
              <AnswerForm
                key={currentQuestion.id}
                question={currentQuestion}
                onSubmit={(value) => submitAnswer(currentQuestion.id, team.teamId, value)}
              />
            )}
          </div>
        )}
      {!progress.isLeaderboardVisible && progress.status === 'break' && (
        <h1 className="mt-16 text-center font-display text-2xl">Grading in progress…</h1>
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
