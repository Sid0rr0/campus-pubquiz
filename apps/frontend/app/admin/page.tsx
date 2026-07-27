'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { AnswerView, QuestionView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { ImportPanel } from '@/app/admin/import-panel';

const ADMIN_PASSWORD_STORAGE_KEY = 'campus-pubquiz-admin-password';
const EMPTY_QUESTIONS: QuestionView[] = [];

function getStoredAdminPassword(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) ?? '';
}

interface GradeRowProps {
  answer: AnswerView;
  maxPoints: number;
  onGrade: (points: number) => void;
}

interface GradeOption {
  display: string;
  ariaSuffix: string;
  value: number;
}

function gradeOptions(maxPoints: number): GradeOption[] {
  return [
    { display: '0', ariaSuffix: '0 points', value: 0 },
    { display: '½', ariaSuffix: 'half points', value: maxPoints / 2 },
    { display: String(maxPoints), ariaSuffix: 'full points', value: maxPoints },
  ];
}

function GradeRow({ answer, maxPoints, onGrade }: GradeRowProps) {
  const isGraded = answer.pointsAwarded !== null;
  const options = gradeOptions(maxPoints);
  const matchesAGradeOption = options.some((option) => option.value === answer.pointsAwarded);

  return (
    <li className="flex items-center gap-3.5 rounded-xl border border-foreground/15 bg-white px-4 py-3">
      <span className="w-40 shrink-0 font-extrabold">{answer.teamName}</span>
      <span className="flex-1 text-[15px]">{answer.value}</span>
      {isGraded && !matchesAGradeOption && (
        <span className="sr-only">Awarded {answer.pointsAwarded} points</span>
      )}
      <div className="flex gap-1.5">
        {options.map(({ display, ariaSuffix, value }) => {
          const isSelected = isGraded && answer.pointsAwarded === value;
          return (
            <button
              key={display}
              type="button"
              disabled={isGraded}
              aria-label={`Grade ${answer.teamName} ${ariaSuffix}`}
              onClick={() => onGrade(value)}
              className={
                isSelected
                  ? 'flex h-9 min-w-11 items-center justify-center rounded-lg bg-green font-extrabold text-white'
                  : 'flex h-9 min-w-11 items-center justify-center rounded-lg border-1.5 border-foreground/30 font-extrabold disabled:opacity-40'
              }
            >
              {isSelected ? `✓ ${value}` : display}
            </button>
          );
        })}
      </div>
    </li>
  );
}

export default function AdminPage() {
  const [passwordInput, setPasswordInput] = useState(() => getStoredAdminPassword());
  const [hasSubmittedPassword, setHasSubmittedPassword] = useState(() => Boolean(getStoredAdminPassword()));
  const [submittedPassword, setSubmittedPassword] = useState(() => getStoredAdminPassword());
  const [gradingIndex, setGradingIndex] = useState(0);
  const {
    snapshot,
    connectionError,
    sendAction,
    liveAnswers,
    gradeAnswer,
    quizzes = null,
    requestQuizzes = () => {},
    selectQuiz = () => {},
    listAnswers = () => {},
  } = useGameSocket('admin', submittedPassword, hasSubmittedPassword);

  const gameStatus = snapshot?.progress.status;
  const canChooseQuiz = gameStatus === 'lobby' || gameStatus === 'ended';

  const gradingQuestions = snapshot?.blockQuestions ?? EMPTY_QUESTIONS;
  const safeGradingIndex = Math.min(gradingIndex, Math.max(gradingQuestions.length - 1, 0));
  const gradingQuestion = gameStatus === 'break' ? gradingQuestions[safeGradingIndex] : undefined;
  const gradingQuestionId = gradingQuestion?.id;

  useEffect(() => {
    if (gameStatus === 'lobby' || gameStatus === 'ended') {
      requestQuizzes();
    }
  }, [gameStatus, requestQuizzes]);

  useEffect(() => {
    // Each grading break starts back at the first question of the block.
    if (gameStatus !== 'break') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGradingIndex(0);
    }
  }, [gameStatus]);

  useEffect(() => {
    if (gradingQuestionId) {
      listAnswers(gradingQuestionId);
    }
  }, [gradingQuestionId, listAnswers]);

  function handleSubmitPassword(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    window.localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, passwordInput);
    setHasSubmittedPassword(true);
    setSubmittedPassword(passwordInput);
  }

  if (!hasSubmittedPassword && !snapshot && !connectionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <form onSubmit={handleSubmitPassword} className="flex w-72 flex-col gap-2">
          <label htmlFor="admin-password" className="text-xs font-extrabold tracking-wide text-foreground/55">
            Admin password
          </label>
          <input
            id="admin-password"
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            className="min-h-12 rounded-xl border-2 border-foreground/35 bg-white px-4 text-lg font-bold"
          />
          <button
            type="submit"
            className="mt-2 min-h-12 rounded-xl bg-magenta font-display text-lg text-white shadow-[0_3px_0_#b8006d]"
          >
            Connect
          </button>
        </form>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        {connectionError && (
          <p role="alert" className="font-extrabold text-magenta">
            {connectionError}
          </p>
        )}
        <p className="font-display text-xl">Connecting…</p>
      </main>
    );
  }

  const { progress, currentQuestion, leaderboard = [], teams = [], answeredTeamIds = [] } = snapshot;
  const showGrading = liveAnswers && currentQuestion && liveAnswers.questionId === currentQuestion.id;
  const showAnswerStatus = progress.status === 'question_open';
  const canStartQuiz = progress.status === 'lobby';
  const canAdvance = progress.status === 'question_open' || progress.status === 'reveal';
  const canFinishGrading = progress.status === 'break';
  const canEndQuiz = progress.status !== 'ended';

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-72 shrink-0 flex-col gap-5 bg-foreground p-5 text-background">
        <h1 className="font-display text-lg">Quiz Master</h1>
        {connectionError && (
          <p role="alert" className="font-extrabold text-magenta">
            {connectionError}
          </p>
        )}
        <p className="text-sm font-bold">Status: {progress.status} ({snapshot?.joinCode})</p>
        {currentQuestion && <p className="text-sm">Current question: {currentQuestion.prompt}</p>}
        <div className="flex flex-col gap-2">
          {canStartQuiz && (
            <button
              onClick={() => sendAction('START_QUIZ')}
              className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
            >
              Start Quiz
            </button>
          )}
          {canAdvance && (
            <button
              onClick={() => sendAction('ADVANCE')}
              className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
            >
              Advance
            </button>
          )}
          {canFinishGrading && (
            <button
              onClick={() => sendAction('FINISH_GRADING')}
              className="min-h-12 rounded-lg bg-magenta text-sm font-extrabold text-white"
            >
              Finish Grading
            </button>
          )}
          <button
            onClick={() => sendAction('TOGGLE_LEADERBOARD')}
            className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
          >
            Toggle Leaderboard
          </button>
          {canEndQuiz && (
            <button
              onClick={() => sendAction('END_QUIZ')}
              className="min-h-11 rounded-lg border-2 border-background/25 text-sm font-extrabold text-background/60"
            >
              End Quiz
            </button>
          )}
        </div>
        {teams.length > 0 && (
          <section className="mt-auto flex flex-col gap-2 border-t border-background/20 pt-4">
            <h2 className="text-xs font-extrabold tracking-wide text-background/60">
              Teams ({teams.length})
            </h2>
            <ul className="flex flex-col gap-1">
              {teams.map((team) => {
                const hasAnswered = showAnswerStatus && answeredTeamIds.includes(team.teamId);
                return (
                  <li
                    key={team.teamId}
                    aria-label={
                      showAnswerStatus
                        ? `${team.teamName} ${hasAnswered ? 'has answered' : 'has not answered yet'}`
                        : undefined
                    }
                    className="text-sm font-bold"
                  >
                    {team.teamName}
                    {hasAnswered && (
                      <span aria-hidden="true" className="ml-1 text-cyan">
                        ✓
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </aside>
      <div className="flex flex-1 flex-col gap-6 p-7">
        {canChooseQuiz && (
          <ImportPanel adminPassword={submittedPassword} onImported={requestQuizzes} />
        )}
        {canChooseQuiz && quizzes && (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl">
              {progress.status === 'ended' ? 'Choose New Quiz' : 'Choose Quiz'}
            </h2>
            <ul className="flex flex-col gap-2">
              {quizzes.quizzes.map((quiz) => {
                const isActive = quiz.id === quizzes.activeQuizId;
                return (
                  <li key={quiz.id}>
                    <button
                      type="button"
                      aria-label={isActive ? `Restart quiz ${quiz.title}` : `Select quiz ${quiz.title}`}
                      onClick={() => selectQuiz(quiz.id)}
                      className={
                        isActive
                          ? 'flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-cyan bg-white px-4 font-extrabold'
                          : 'flex min-h-11 w-full items-center justify-between rounded-xl border border-foreground/15 bg-white px-4 font-extrabold'
                      }
                    >
                      <span>{quiz.title}</span>
                      {isActive && <span className="text-sm text-cyan">active</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {progress.status === 'break' && gradingQuestion && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">
                Grading question {safeGradingIndex + 1} of {gradingQuestions.length}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous question"
                  disabled={safeGradingIndex === 0}
                  onClick={() => setGradingIndex(safeGradingIndex - 1)}
                  className="flex h-10 min-w-11 items-center justify-center rounded-lg border-1.5 border-foreground/30 font-extrabold disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label="Next question"
                  disabled={safeGradingIndex >= gradingQuestions.length - 1}
                  onClick={() => setGradingIndex(safeGradingIndex + 1)}
                  className="flex h-10 min-w-11 items-center justify-center rounded-lg border-1.5 border-foreground/30 font-extrabold disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
            <p className="text-[15px] font-bold">{gradingQuestion.prompt}</p>
            {liveAnswers && liveAnswers.questionId === gradingQuestion.id && (
              <ul className="flex flex-col gap-2">
                {liveAnswers.answers.map((answer) => (
                  <GradeRow
                    key={answer.answerId}
                    answer={answer}
                    maxPoints={gradingQuestion.points}
                    onGrade={(points) => gradeAnswer(answer.answerId, points)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
        {showGrading && (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl">Answers</h2>
            <ul className="flex flex-col gap-2">
              {liveAnswers.answers.map((answer) => (
                <GradeRow
                  key={answer.answerId}
                  answer={answer}
                  maxPoints={currentQuestion.points}
                  onGrade={(points) => gradeAnswer(answer.answerId, points)}
                />
              ))}
            </ul>
          </section>
        )}
        {leaderboard.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl">Leaderboard</h2>
            <Leaderboard entries={leaderboard} />
          </section>
        )}
      </div>
    </main>
  );
}
