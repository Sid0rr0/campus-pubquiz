'use client';

import { useGameSocket } from '../lib/use-game-socket';

export default function AdminPage() {
  const { snapshot, connectionError, sendAction } = useGameSocket('admin');

  if (!snapshot) {
    return (
      <main>
        <p>Connecting…</p>
      </main>
    );
  }

  const { progress, currentQuestion } = snapshot;

  return (
    <main>
      <h1>Admin</h1>
      {connectionError && <p role="alert">{connectionError}</p>}
      <p>Status: {progress.status}</p>
      {currentQuestion && <p>Current question: {currentQuestion.prompt}</p>}
      <div>
        <button onClick={() => sendAction('START_QUIZ')}>Start Quiz</button>
        <button onClick={() => sendAction('LOCK_ANSWERS')}>Lock Answers</button>
        <button onClick={() => sendAction('ADVANCE')}>Advance</button>
        <button onClick={() => sendAction('FINISH_GRADING')}>Finish Grading</button>
        <button onClick={() => sendAction('TOGGLE_LEADERBOARD')}>Toggle Leaderboard</button>
        <button onClick={() => sendAction('END_QUIZ')}>End Quiz</button>
      </div>
    </main>
  );
}
