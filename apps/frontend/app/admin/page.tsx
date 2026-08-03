'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getBlockStartRoundIndex, type QuizSummaryRound } from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { Leaderboard } from '@/app/components/leaderboard';
import { AdminLoginForm } from '@/app/admin/admin-login-form';
import { DesktopSidebar } from '@/app/admin/desktop-sidebar';
import { ImportPanel } from '@/app/admin/import-panel';
import { QuizPickerPanel } from '@/app/admin/quiz-picker-panel';
import { QuestionBrowserPanel } from '@/app/admin/question-browser-panel';
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
  const activeQuizRounds =
    quizzes?.quizzes.find((quiz) => quiz.id === displayedActiveQuizId)?.rounds ?? EMPTY_ROUNDS;

  function handleSelectQuiz(quizId: number): void {
    selectQuiz(quizId);
    setActiveQuizIdOverride(quizId);
  }

  if (!hasSubmittedPassword && !snapshot && !connectionError) {
    return (
      <AdminLoginForm
        passwordInput={passwordInput}
        onPasswordInputChange={setPasswordInput}
        onSubmit={handleSubmitPassword}
      />
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
    ((progress.status === 'break' || progress.status === 'reveal') &&
      (progress.revealIndex > 0 || activeBlockStartIndex > 0));
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
      <DesktopSidebar
        progressStatus={progress.status}
        roundIndex={progress.roundIndex}
        questionIndex={progress.questionIndex}
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
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-7">
        {canChooseQuiz && (
          <ImportPanel adminPassword={submittedPassword} onImported={requestQuizzes} />
        )}
        {canChooseQuiz && quizzes && (
          <QuizPickerPanel
            progressStatus={progress.status}
            quizzes={quizzes}
            displayedActiveQuizId={displayedActiveQuizId}
            onSelectQuiz={handleSelectQuiz}
          />
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
