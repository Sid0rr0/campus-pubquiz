'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { QuestionView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';
const TEAM_TOKEN_STORAGE_KEY = 'campus-pubquiz-team-token';

interface AnswerFormProps {
  question: QuestionView;
  onSubmit: (value: string) => void;
}

function AnswerForm({ question, onSubmit }: AnswerFormProps) {
  const [value, setValue] = useState('');

  if (question.type === 'multiple_choice' && question.options) {
    return (
      <div>
        {question.options.map((option) => (
          <button key={option} type="button" onClick={() => onSubmit(option)}>
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
    <form onSubmit={handleSubmit}>
      <label htmlFor="answer-value">Your answer</label>
      <input id="answer-value" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="submit">Submit</button>
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
      <main>
        <h1>Join the quiz</h1>
        <form onSubmit={handleJoin}>
          <label htmlFor="team-name">Team name</label>
          <input id="team-name" value={nameInput} onChange={(event) => setNameInput(event.target.value)} />
          <button type="submit">Join</button>
        </form>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main>
        <p>Playing as {teamName}</p>
        <p>Connecting…</p>
      </main>
    );
  }

  const { progress, currentQuestion } = snapshot;

  return (
    <main>
      <p>Playing as {teamName}</p>
      {progress.isLeaderboardVisible && <h1>Leaderboard</h1>}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <h1>Waiting for the quiz to start…</h1>
      )}
      {!progress.isLeaderboardVisible &&
        (progress.status === 'question_open' || progress.status === 'locked') &&
        currentQuestion && (
          <>
            <h1>{currentQuestion.prompt}</h1>
            {progress.status === 'locked' && <p>Answers locked</p>}
            {progress.status === 'question_open' && team && (
              <AnswerForm
                key={currentQuestion.id}
                question={currentQuestion}
                onSubmit={(value) => submitAnswer(currentQuestion.id, team.teamId, value)}
              />
            )}
          </>
        )}
      {!progress.isLeaderboardVisible && progress.status === 'break' && <h1>Grading in progress…</h1>}
      {!progress.isLeaderboardVisible && progress.status === 'reveal' && <h1>Revealing answers…</h1>}
      {!progress.isLeaderboardVisible && progress.status === 'ended' && <h1>Quiz complete!</h1>}
    </main>
  );
}
