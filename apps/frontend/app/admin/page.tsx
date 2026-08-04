'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  getBlockStartRoundIndex,
  type GameStatus,
  type QuizSummaryRound,
  type QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import { Leaderboard } from '@/app/components/leaderboard';
import { AdminLoginForm } from '@/app/admin/admin-login-form';
import { DesktopSidebar } from '@/app/admin/desktop-sidebar';
import { ImportPanel } from '@/app/admin/import-panel';
import { QuizPickerPanel } from '@/app/admin/quiz-picker-panel';
import { QuestionBrowserPanel } from '@/app/admin/question-browser-panel';
import { MobileAdminBar } from '@/app/admin/mobile-admin-bar';
import { useAdminKeyboardShortcuts } from '@/app/admin/use-admin-keyboard-shortcuts';

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
  const [quizzes, setQuizzes] = useState<QuizzesListedPayload | null>(null);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);

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
    selectQuiz = () => {},
    listAnswers = () => {},
  } = useGameSocket('admin', submittedPassword, hasSubmittedPassword);

  const gameStatus = snapshot?.progress.status;
  const canChooseQuiz = gameStatus === 'lobby' || gameStatus === 'ended';

  const refetchQuizzes = useCallback(() => {
    fetchQuizzes(submittedPassword)
      .then((payload) => {
        setQuizzes(payload);
        setQuizzesError(null);
      })
      .catch((error: unknown) => {
        setQuizzesError(error instanceof QuizApiError ? error.message : 'Could not load quizzes');
      });
  }, [submittedPassword]);

  const lastFetchedStatusRef = useRef<GameStatus | undefined>(undefined);
  useEffect(() => {
    // Fetch once on connect (any status) so the question browser has data
    // immediately, then keep refreshing on every lobby/ended visit to pick
    // up re-imports. Keyed off the *transition*, not off `quizzes` itself —
    // depending on `quizzes` here would re-trigger this effect every time
    // its own fetch resolves, since each response is a fresh object even
    // when the quiz list hasn't changed, causing an infinite refetch loop.
    if (!gameStatus) return;
    const isFirstFetch = lastFetchedStatusRef.current === undefined;
    const enteredChoosableStatus =
      (gameStatus === 'lobby' || gameStatus === 'ended') &&
      lastFetchedStatusRef.current !== gameStatus;
    if (isFirstFetch || enteredChoosableStatus) {
      refetchQuizzes();
    }
    lastFetchedStatusRef.current = gameStatus;
  }, [gameStatus, refetchQuizzes]);

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

  const roundIndex = snapshot?.progress.roundIndex ?? 0;
  const revealIndex = snapshot?.progress.revealIndex ?? 0;
  const isLeaderboardVisible = snapshot?.progress.isLeaderboardVisible ?? false;
  const leaderboardTeamCount = snapshot?.leaderboard?.length ?? 0;
  const leaderboardRevealCount = snapshot?.leaderboardRevealCount ?? 0;
  // Rounds before the active block are already locked and graded; guard on
  // rounds.length so a stale/incomplete quiz list can never index past its
  // own array inside getBlockStartRoundIndex.
  const activeBlockStartIndex =
    activeQuizRounds.length > roundIndex
      ? getBlockStartRoundIndex(roundIndex, {
          rounds: activeQuizRounds.map((round) => ({
            questionCount: round.questions.length,
            breakAfter: round.breakAfter,
          })),
        })
      : 0;
  const canStartQuiz = gameStatus === 'lobby';
  const canAdvance =
    gameStatus === 'rules' ||
    gameStatus === 'round_intro' ||
    gameStatus === 'question_open' ||
    gameStatus === 'locking' ||
    gameStatus === 'break_intro' ||
    gameStatus === 'break' ||
    gameStatus === 'reveal_intro' ||
    gameStatus === 'reveal';
  const canGoToPreviousQuestion =
    gameStatus === 'round_intro' ||
    gameStatus === 'question_open' ||
    gameStatus === 'locking' ||
    // 'break_intro' always steps back to 'locking'; 'reveal' always has
    // somewhere to go back to, at worst its own round's reveal_intro card.
    // Only 'break'/'reveal_intro' can hit the true start of the quiz's
    // reveal history, where Previous has nothing left to do.
    gameStatus === 'break_intro' ||
    gameStatus === 'reveal' ||
    ((gameStatus === 'break' || gameStatus === 'reveal_intro') &&
      (revealIndex > 0 || activeBlockStartIndex > 0));
  const hasUnrevealedTeams = isLeaderboardVisible && leaderboardRevealCount < leaderboardTeamCount;

  useAdminKeyboardShortcuts({
    canAdvance,
    canGoToPreviousQuestion,
    hasUnrevealedTeams,
    isLeaderboardVisible,
    sendAction,
  });

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
    teams = [],
    answeredTeamIds = [],
  } = snapshot;
  const fallbackQuestions = currentQuestion ? [currentQuestion, ...blockQuestions] : blockQuestions;
  const showAnswerStatus =
    progress.status === 'question_open' || progress.status === 'locking';
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
          <ImportPanel adminPassword={submittedPassword} onImported={refetchQuizzes} />
        )}
        {canChooseQuiz && quizzesError && (
          <p role="alert" className="font-extrabold text-magenta">
            {quizzesError}
          </p>
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
