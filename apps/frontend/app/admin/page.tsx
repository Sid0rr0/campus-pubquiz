'use client';

import { useEffect, useState, type FormEvent } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { QuestionView } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { RoundsList } from '@/app/components/rounds-list';
import { ImportPanel } from '@/app/admin/import-panel';
import { AnswersPanel } from '@/app/admin/answers-panel';

const ADMIN_PASSWORD_STORAGE_KEY = 'campus-pubquiz-admin-password';
const EMPTY_QUESTIONS: QuestionView[] = [];

function getStoredAdminPassword(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) ?? '';
}

export default function AdminPage() {
  const [passwordInput, setPasswordInput] = useState('');
  const [hasSubmittedPassword, setHasSubmittedPassword] = useState(false);
  const [submittedPassword, setSubmittedPassword] = useState('');
  const [gradingIndex, setGradingIndex] = useState(0);
  const [pendingQuizId, setPendingQuizId] = useState<number | null>(null);
  const [activeQuizIdOverride, setActiveQuizIdOverride] = useState<number | null>(null);

  useEffect(() => {
    // Deferred to an effect (not a useState initializer) so the server-rendered
    // HTML always starts from the signed-out state — localStorage only exists
    // on the client and would otherwise mismatch during hydration.
    const storedPassword = getStoredAdminPassword();
    if (storedPassword) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPasswordInput(storedPassword);
      setSubmittedPassword(storedPassword);
      setHasSubmittedPassword(true);
    }
  }, []);
  const {
    snapshot,
    connectionError,
    sendAction,
    liveAnswers,
    gradeAnswer,
    kickTeam,
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
    if (!canChooseQuiz) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingQuizId(null);
    }
  }, [canChooseQuiz]);

  useEffect(() => {
    // A fresh quiz list from the server is authoritative; drop the optimistic
    // override so future renders trust `quizzes.activeQuizId` again.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveQuizIdOverride(null);
  }, [quizzes]);

  useEffect(() => {
    // Each grading break starts back at the first question of the block.
    if (gameStatus !== 'break') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGradingIndex(0);
    }
  }, [gameStatus]);

  const currentQuestionId = gameStatus === 'question_open' ? snapshot?.currentQuestion?.id : undefined;
  const answersToTrackId = gameStatus === 'break' ? gradingQuestionId : currentQuestionId;

  useEffect(() => {
    if (answersToTrackId) {
      listAnswers(answersToTrackId);
    }
  }, [answersToTrackId, listAnswers]);

  function handleSubmitPassword(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    window.localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, passwordInput);
    setHasSubmittedPassword(true);
    setSubmittedPassword(passwordInput);
  }

  const displayedActiveQuizId = activeQuizIdOverride ?? quizzes?.activeQuizId ?? null;
  const activeQuizTitle =
    quizzes?.quizzes.find((quiz) => quiz.id === displayedActiveQuizId)?.title ?? null;
  const pendingQuizTitle = quizzes?.quizzes.find((quiz) => quiz.id === pendingQuizId)?.title ?? null;

  function handleConfirmQuizSelection(): void {
    if (!pendingQuizId) {
      return;
    }
    selectQuiz(pendingQuizId);
    setActiveQuizIdOverride(pendingQuizId);
    setPendingQuizId(null);
  }

  function handleCancelQuizSelection(): void {
    setPendingQuizId(null);
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
  const canAdvance =
    progress.status === 'rules' || progress.status === 'question_open' || progress.status === 'reveal';
  const canGoToPreviousQuestion =
    (progress.status === 'question_open' && gradingQuestions.length > 1) ||
    (progress.status === 'reveal' && progress.revealIndex > 0);
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
        {activeQuizTitle && <p className="text-sm font-bold">Quiz: {activeQuizTitle}</p>}
        <p className="text-sm font-bold">Status: {progress.status} ({snapshot?.joinCode})</p>
        <div className="flex flex-col gap-2">
          {canStartQuiz && (
            <button
              onClick={() => sendAction('START_QUIZ')}
              className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
            >
              Start Quiz
            </button>
          )}
          {canGoToPreviousQuestion && (
            <button
              onClick={() => sendAction('PREVIOUS')}
              className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
            >
              Previous
            </button>
          )}
          {canAdvance && (
            <button
              onClick={() => sendAction('ADVANCE')}
              className="min-h-11 rounded-lg border-2 border-cyan text-sm font-extrabold text-cyan"
            >
              {progress.status === 'rules' ? 'Begin Quiz' : 'Advance'}
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
                    className="flex items-center gap-1.5 text-sm font-bold"
                  >
                    <span
                      aria-hidden="true"
                      className={team.isConnected ? 'text-green' : 'text-background/30'}
                    >
                      ●
                    </span>
                    {team.teamName}
                    {hasAnswered && (
                      <span aria-hidden="true" className="ml-1 text-cyan">
                        ✓
                      </span>
                    )}
                    {team.isConnected && (
                      <button
                        type="button"
                        onClick={() => kickTeam(team.teamId)}
                        className="ml-auto text-xs font-extrabold text-magenta underline"
                      >
                        Kick
                      </button>
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
                const isActive = quiz.id === displayedActiveQuizId;
                const isPending = quiz.id === pendingQuizId;
                return (
                  <li key={quiz.id}>
                    <Collapsible.Root
                      open={isPending}
                      onOpenChange={(open) => setPendingQuizId(open ? quiz.id : null)}
                    >
                      <Collapsible.Trigger asChild>
                        <button
                          type="button"
                          aria-label={
                            isPending
                              ? `${quiz.title} selected, awaiting confirmation`
                              : isActive
                                ? `Restart quiz ${quiz.title}`
                                : `Select quiz ${quiz.title}`
                          }
                          className={
                            isPending
                              ? 'flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-magenta bg-white px-4 font-extrabold'
                              : isActive
                                ? 'flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-cyan bg-white px-4 font-extrabold'
                                : 'flex min-h-11 w-full items-center justify-between rounded-xl border border-foreground/15 bg-white px-4 font-extrabold'
                          }
                        >
                          <span>{quiz.title}</span>
                          {isPending && <span className="text-sm text-magenta">selected</span>}
                          {!isPending && isActive && <span className="text-sm text-cyan">active</span>}
                        </button>
                      </Collapsible.Trigger>
                      <Collapsible.Content className="mt-2">
                        <RoundsList rounds={quiz.rounds} />
                      </Collapsible.Content>
                    </Collapsible.Root>
                  </li>
                );
              })}
            </ul>
            {pendingQuizId && (
              <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-magenta bg-white px-4 py-3">
                <p className="text-sm font-bold">
                  {pendingQuizId === displayedActiveQuizId
                    ? `Restart "${pendingQuizTitle}"? This clears teams and answers.`
                    : `Start "${pendingQuizTitle}"? This replaces the current game session.`}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={handleCancelQuizSelection}
                    className="min-h-10 rounded-lg border-2 border-foreground/30 px-4 text-sm font-extrabold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmQuizSelection}
                    className="min-h-10 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {progress.status === 'break' && gradingQuestion && (
          <>
            {liveAnswers && liveAnswers.questionId === gradingQuestion.id ? (
              <AnswersPanel
                liveAnswers={liveAnswers}
                teams={teams}
                onGrade={gradeAnswer}
                nav={{
                  index: safeGradingIndex,
                  total: gradingQuestions.length,
                  onPrevious: () => setGradingIndex(safeGradingIndex - 1),
                  onNext: () => setGradingIndex(safeGradingIndex + 1),
                }}
              />
            ) : (
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
              </section>
            )}
          </>
        )}
        {showGrading && (
          <AnswersPanel liveAnswers={liveAnswers} teams={teams} onGrade={gradeAnswer} />
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
