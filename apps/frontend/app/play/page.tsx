'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useGameSocket } from '@/app/lib/use-game-socket';

const TEAM_NAME_STORAGE_KEY = 'campus-pubquiz-team-name';

export default function PlayPage() {
  const [teamName, setTeamName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const { snapshot } = useGameSocket('players');

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored team name can only
    // be read after mount - this is the "synchronize with an external system"
    // case React's own docs carve out as a legitimate effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(window.localStorage.getItem(TEAM_NAME_STORAGE_KEY));
  }, []);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, trimmed);
    setTeamName(trimmed);
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

  return (
    <main>
      <p>Playing as {teamName}</p>
      {!snapshot && <p>Connecting…</p>}
      {snapshot && (
        <>
          {snapshot.progress.isLeaderboardVisible && <h1>Leaderboard</h1>}
          {!snapshot.progress.isLeaderboardVisible && snapshot.progress.status === 'lobby' && (
            <h1>Waiting for the quiz to start…</h1>
          )}
          {!snapshot.progress.isLeaderboardVisible &&
            (snapshot.progress.status === 'question_open' || snapshot.progress.status === 'locked') &&
            snapshot.currentQuestion && (
              <>
                <h1>{snapshot.currentQuestion.prompt}</h1>
                {snapshot.progress.status === 'locked' && <p>Answers locked</p>}
              </>
            )}
          {!snapshot.progress.isLeaderboardVisible && snapshot.progress.status === 'break' && (
            <h1>Grading in progress…</h1>
          )}
          {!snapshot.progress.isLeaderboardVisible && snapshot.progress.status === 'reveal' && (
            <h1>Revealing answers…</h1>
          )}
          {!snapshot.progress.isLeaderboardVisible && snapshot.progress.status === 'ended' && <h1>Quiz complete!</h1>}
        </>
      )}
    </main>
  );
}
