'use client';

import { useGameSocket } from '../lib/use-game-socket';

export default function DisplayPage() {
  const { snapshot } = useGameSocket('display');

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
      {progress.isLeaderboardVisible && <h1>Leaderboard</h1>}
      {!progress.isLeaderboardVisible && progress.status === 'lobby' && (
        <h1>Waiting for the quiz to start…</h1>
      )}
      {!progress.isLeaderboardVisible &&
        (progress.status === 'question_open' || progress.status === 'locked') &&
        currentQuestion && (
          <>
            <h1>{currentQuestion.prompt}</h1>
            {currentQuestion.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- quiz media comes from arbitrary external URLs
              <img src={currentQuestion.mediaUrl} alt="" />
            )}
            {currentQuestion.options && (
              <ul>
                {currentQuestion.options.map((option) => (
                  <li key={option}>{option}</li>
                ))}
              </ul>
            )}
            {progress.status === 'locked' && <p>Answers locked</p>}
          </>
        )}
      {!progress.isLeaderboardVisible && progress.status === 'break' && <h1>Grading in progress…</h1>}
      {!progress.isLeaderboardVisible && progress.status === 'reveal' && <h1>Revealing answers…</h1>}
      {!progress.isLeaderboardVisible && progress.status === 'ended' && <h1>Quiz complete!</h1>}
    </main>
  );
}
