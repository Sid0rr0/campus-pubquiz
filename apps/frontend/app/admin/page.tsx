'use client';

import { useState } from 'react';
import type { AnswerView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';

interface GradeRowProps {
  answer: AnswerView;
  onGrade: (points: number) => void;
}

function GradeRow({ answer, onGrade }: GradeRowProps) {
  const [points, setPoints] = useState('');

  return (
    <li>
      <span>{answer.teamName}</span>
      <span>{answer.value}</span>
      {answer.pointsAwarded === null ? (
        <>
          <label htmlFor={`points-${answer.answerId}`}>Points for {answer.teamName}</label>
          <input
            id={`points-${answer.answerId}`}
            type="number"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
          />
          <button onClick={() => onGrade(Number(points))}>Grade {answer.teamName}</button>
        </>
      ) : (
        <span>{answer.pointsAwarded} points</span>
      )}
    </li>
  );
}

export default function AdminPage() {
  const { snapshot, connectionError, sendAction, liveAnswers, gradeAnswer } = useGameSocket('admin');

  if (!snapshot) {
    return (
      <main>
        <p>Connecting…</p>
      </main>
    );
  }

  const { progress, currentQuestion, leaderboard = [] } = snapshot;

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
      {liveAnswers && currentQuestion && liveAnswers.questionId === currentQuestion.id && (
        <section>
          <h2>Answers</h2>
          <ul>
            {liveAnswers.answers.map((answer) => (
              <GradeRow
                key={answer.answerId}
                answer={answer}
                onGrade={(points) => gradeAnswer(answer.answerId, points)}
              />
            ))}
          </ul>
        </section>
      )}
      {leaderboard.length > 0 && (
        <section>
          <h2>Leaderboard</h2>
          <Leaderboard entries={leaderboard} />
        </section>
      )}
    </main>
  );
}
