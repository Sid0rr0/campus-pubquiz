'use client';

import { useEffect, useState, type FormEvent } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { getBlockStartRoundIndex, type QuizSummaryRound } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { RoundsList } from '@/app/components/rounds-list';
import { ImportPanel } from '@/app/admin/import-panel';
import { QuestionBrowserPanel } from '@/app/admin/question-browser-panel';
import { NavigationButtons } from '@/app/admin/navigation-buttons';
import { AdminActions } from '@/app/admin/admin-actions';
import { TeamsPanel } from '@/app/admin/teams-panel';
import { MobileAdminBar } from '@/app/admin/mobile-admin-bar';

const ADMIN_PASSWORD_STORAGE_KEY = 'campus-pubquiz-admin-password';
const EMPTY_ROUNDS: QuizSummaryRound[] = [];

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
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
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

  useEffect(() => {
    // Fetch once on connect (any status) so the question browser has data
    // immediately, then keep refreshing on every lobby/ended visit to pick
    // up re-imports.
    if (gameStatus === 'lobby' || gameStatus === 'ended' || (gameStatus && quizzes === null)) {
      requestQuizzes();
    }
  }, [gameStatus, quizzes, requestQuizzes]);

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
    // A newly selected/restarted quiz invalidates any question id picked
    // under the previous session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedQuestionId(null);
  }, [snapshot?.joinCode]);

  // Grading is independent of game status: default to whatever question is
  // currently open, or the just-locked block's first question during a
  // break, but a manual pick from the browser sticks regardless of how the
  // state machine moves afterward.
  const currentQuestionId = snapshot?.currentQuestion?.id ?? null;
  const defaultBlockQuestionId = snapshot?.blockQuestions?.[0]?.id ?? null;
  const effectiveQuestionId = selectedQuestionId ?? currentQuestionId ?? defaultBlockQuestionId;

  useEffect(() => {
    if (effectiveQuestionId !== null) {
      listAnswers(effectiveQuestionId);
    }
  }, [effectiveQuestionId, listAnswers]);

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
  const activeQuizRounds =
    quizzes?.quizzes.find((quiz) => quiz.id === displayedActiveQuizId)?.rounds ?? EMPTY_ROUNDS;

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

  const {
    progress,
    currentQuestion,
    blockQuestions = [],
    leaderboard = [],
    leaderboardRevealCount = 0,
    teams = [],
    answeredTeamIds = [],
  } = snapshot;
  const fallbackQuestions = currentQuestion ? [currentQuestion, ...blockQuestions] : blockQuestions;
  // Rounds before the active block are already locked and graded; guard on
  // rounds.length so a stale/incomplete quiz list can never index past its
  // own array inside getBlockStartRoundIndex.
  const activeBlockStartIndex =
    activeQuizRounds.length > progress.roundIndex
      ? getBlockStartRoundIndex(progress.roundIndex, {
          rounds: activeQuizRounds.map((round) => ({
            questionCount: round.questions.length,
            breakAfter: round.breakAfter,
          })),
        })
      : 0;
  const showAnswerStatus =
    progress.status === 'question_open' || progress.status === 'locking';
  const canStartQuiz = progress.status === 'lobby';
  const canAdvance =
    progress.status === 'rules' ||
    progress.status === 'round_intro' ||
    progress.status === 'question_open' ||
    progress.status === 'locking' ||
    progress.status === 'reveal';
  const canGoToPreviousQuestion =
    progress.status === 'round_intro' ||
    progress.status === 'question_open' ||
    progress.status === 'locking' ||
    (progress.status === 'reveal' && progress.revealIndex > 0);
  const canFinishGrading = progress.status === 'break';
  const canEndQuiz = progress.status !== 'ended';

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <MobileAdminBar
        progressStatus={progress.status}
        joinCode={snapshot.joinCode}
        activeQuizTitle={activeQuizTitle}
        connectionError={connectionError}
        canStartQuiz={canStartQuiz}
        canGoToPreviousQuestion={canGoToPreviousQuestion}
        canAdvance={canAdvance}
        canFinishGrading={canFinishGrading}
        canEndQuiz={canEndQuiz}
        isLeaderboardVisible={progress.isLeaderboardVisible}
        leaderboardRevealCount={leaderboardRevealCount}
        leaderboardTeamCount={leaderboard.length}
        onAction={sendAction}
        teams={teams}
        showAnswerStatus={showAnswerStatus}
        answeredTeamIds={answeredTeamIds}
        onKickTeam={kickTeam}
      />
      <aside className="hidden w-72 shrink-0 flex-col gap-5 bg-foreground p-5 text-background md:flex">
        <h1 className="font-display text-lg">Quiz Master</h1>
        {connectionError && (
          <p role="alert" className="font-extrabold text-magenta">
            {connectionError}
          </p>
        )}
        {activeQuizTitle && <p className="text-sm font-bold">Quiz: {activeQuizTitle}</p>}
        <p className="text-sm font-bold">Status: {progress.status} ({snapshot?.joinCode})</p>
        <div className="flex flex-col gap-2">
          <NavigationButtons
            progressStatus={progress.status}
            canGoToPreviousQuestion={canGoToPreviousQuestion}
            canAdvance={canAdvance}
            isLeaderboardVisible={progress.isLeaderboardVisible}
            leaderboardRevealCount={leaderboardRevealCount}
            leaderboardTeamCount={leaderboard.length}
            onAction={sendAction}
          />
          <AdminActions
            canStartQuiz={canStartQuiz}
            canFinishGrading={canFinishGrading}
            canEndQuiz={canEndQuiz}
            isLeaderboardVisible={progress.isLeaderboardVisible}
            onAction={sendAction}
          />
        </div>
        <TeamsPanel
          teams={teams}
          showAnswerStatus={showAnswerStatus}
          answeredTeamIds={answeredTeamIds}
          onKickTeam={kickTeam}
          className="mt-auto border-t border-background/20 pt-4"
        />
      </aside>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-7">
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
        <QuestionBrowserPanel
          rounds={activeQuizRounds}
          currentRoundIndex={progress.roundIndex}
          activeBlockStartIndex={activeBlockStartIndex}
          selectedQuestionId={effectiveQuestionId}
          onSelectQuestion={setSelectedQuestionId}
          liveAnswers={liveAnswers}
          teams={teams}
          onGrade={gradeAnswer}
          fallbackQuestions={fallbackQuestions}
        />
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
