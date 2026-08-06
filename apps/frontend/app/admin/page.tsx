'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getBlockStartRoundIndex,
  type GameStatus,
  type QuizSummaryRound,
  type QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import { useAuth } from '@/app/lib/use-auth';
import { Leaderboard } from '@/app/components/leaderboard';
import { AdminLoginForm } from '@/app/admin/admin-login-form';
import { AdminRegisterForm } from '@/app/admin/admin-register-form';
import { PendingApprovalView } from '@/app/admin/pending-approval-view';
import { DesktopSidebar } from '@/app/admin/desktop-sidebar';
import { ImportPanel } from '@/app/admin/import-panel';
import { QuizPickerPanel } from '@/app/admin/quiz-picker-panel';
import { QuestionBrowserPanel } from '@/app/admin/question-browser-panel';
import { MobileAdminBar } from '@/app/admin/mobile-admin-bar';
import { SessionPickerPanel } from '@/app/admin/session-picker-panel';
import { useAdminKeyboardShortcuts } from '@/app/admin/use-admin-keyboard-shortcuts';

const EMPTY_ROUNDS: QuizSummaryRound[] = [];

function AdminPageContent() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('code');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [registerValidationError, setRegisterValidationError] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [activeQuizIdOverride, setActiveQuizIdOverride] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<QuizzesListedPayload | null>(null);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);

  const isAuthenticated = auth.status === 'authenticated';
  const {
    snapshot,
    connectionError,
    sendAction,
    liveAnswers,
    gradeAnswer,
    kickTeam,
    awardBonus,
    selectQuiz = () => {},
    listAnswers = () => {},
  } = useGameSocket('admin', isAuthenticated && Boolean(sessionCode), sessionCode ?? undefined);

  useEffect(() => {
    // SELECT_QUIZ always mints a brand-new session (never overwrites the
    // current one) and migrates this admin socket into it — keep the URL's
    // ?code= following that migration so a refresh lands back in the same
    // session instead of falling through to the picker screen.
    if (snapshot && snapshot.joinCode !== sessionCode) {
      router.replace(`/admin?code=${snapshot.joinCode}`);
    }
  }, [snapshot, sessionCode, router]);

  const gameStatus = snapshot?.progress.status;
  const canChooseQuiz = gameStatus === 'lobby' || gameStatus === 'ended';

  // Guards refetchQuizzes' setState calls against resolving after this page
  // has unmounted (e.g. logging out or navigating away mid-fetch).
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetchQuizzes = useCallback(() => {
    fetchQuizzes()
      .then((payload) => {
        if (!isMountedRef.current) return;
        setQuizzes(payload);
        setQuizzesError(null);
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current) return;
        setQuizzesError(error instanceof QuizApiError ? error.message : 'Could not load quizzes');
      });
  }, []);

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

  const revealIndex = snapshot?.progress.revealIndex ?? 0;
  // Which question the audience is actually looking at right now: only the
  // open question while it's open/locking, or the reveal question at
  // `revealIndex` once the reveal walk starts. `break` shows a plain
  // grading message with no specific question (grading happens off-screen
  // in this panel), so it's deliberately excluded here — the "B" marker
  // below covers it instead.
  const displayQuestionId =
    gameStatus === 'question_open' || gameStatus === 'locking'
      ? (snapshot?.currentQuestion?.id ?? null)
      : gameStatus === 'reveal'
        ? (snapshot?.revealQuestions?.[revealIndex]?.id ?? null)
        : null;
  // round_intro/reveal_intro show a round's title card instead of a question
  // — no question id exists to mark on-display, so the browser instead marks
  // that round's "T" indicator. reveal_intro's round comes from the reveal
  // question at the crossed-into position (progress.roundIndex stays pinned
  // to the block's last round throughout break/reveal, so it can't be used
  // here); round_intro's round is progress.roundIndex itself.
  const revealIntroRoundNumber = snapshot?.revealQuestions?.[revealIndex]?.roundNumber;
  const displayTitleRoundIndex =
    gameStatus === 'round_intro'
      ? (snapshot?.progress.roundIndex ?? null)
      : gameStatus === 'reveal_intro' && revealIntroRoundNumber !== undefined
        ? revealIntroRoundNumber - 1
        : null;
  // break_intro and break both show the block's plain grading/break card —
  // progress.roundIndex is the breakAfter round whose block just finished,
  // so the "B" indicator on that round's row lights up for the whole break,
  // not just its intro moment.
  const displayBreakRoundIndex =
    gameStatus === 'break_intro' || gameStatus === 'break' ? (snapshot?.progress.roundIndex ?? null) : null;
  // Grading defaults to whatever's on display, but a manual pick from the
  // browser sticks — until Prev/Advance brings the displayed question back
  // around to match it, at which point the sync effect below drops the
  // override so the two keep moving together again instead of the pick
  // going stale. Outside display statuses, grading still needs *something*
  // to default to (break has real questions to grade even though nothing
  // shows on /display), so it falls back to the block's first question —
  // naturally null wherever blockQuestions is empty (e.g. round_intro).
  const defaultBlockQuestionId = snapshot?.blockQuestions?.[0]?.id ?? null;
  const effectiveQuestionId = selectedQuestionId ?? displayQuestionId ?? defaultBlockQuestionId;

  useEffect(() => {
    if (effectiveQuestionId !== null) {
      listAnswers(effectiveQuestionId);
    }
  }, [effectiveQuestionId, listAnswers]);

  useEffect(() => {
    // Once the admin's manual pick coincides with the question actually on
    // /display (either because they picked the displayed question, or
    // Prev/Advance brought the display back around to it), drop the
    // override so grading resumes following the display automatically.
    if (selectedQuestionId !== null && selectedQuestionId === displayQuestionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedQuestionId(null);
    }
  }, [selectedQuestionId, displayQuestionId]);

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    // auth.error already surfaces the failure message — this catch only
    // exists so the rejection auth.login() rethrows doesn't go unhandled.
    auth.login(usernameInput, passwordInput).catch(() => {});
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (passwordInput !== confirmPasswordInput) {
      setRegisterValidationError('Passwords do not match');
      return;
    }
    setRegisterValidationError(null);
    auth
      .register(usernameInput, passwordInput)
      .then(() => {
        setPasswordInput('');
        setConfirmPasswordInput('');
      })
      .catch(() => {});
  }

  function switchAuthView(view: 'login' | 'register'): void {
    setAuthView(view);
    setRegisterValidationError(null);
    auth.clearError();
  }

  function handleLogout(): void {
    auth.logout();
    setAuthView('login');
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

  if (auth.status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  if (auth.status === 'pending') {
    return <PendingApprovalView onLogout={handleLogout} />;
  }

  if (auth.status === 'unauthenticated') {
    return authView === 'register' ? (
      <AdminRegisterForm
        usernameInput={usernameInput}
        passwordInput={passwordInput}
        confirmPasswordInput={confirmPasswordInput}
        onUsernameInputChange={setUsernameInput}
        onPasswordInputChange={setPasswordInput}
        onConfirmPasswordInputChange={setConfirmPasswordInput}
        onSubmit={handleRegisterSubmit}
        onSwitchToLogin={() => switchAuthView('login')}
        error={registerValidationError ?? auth.error}
      />
    ) : (
      <AdminLoginForm
        usernameInput={usernameInput}
        passwordInput={passwordInput}
        onUsernameInputChange={setUsernameInput}
        onPasswordInputChange={setPasswordInput}
        onSubmit={handleLoginSubmit}
        onSwitchToRegister={() => switchAuthView('register')}
        error={auth.error}
      />
    );
  }

  if (!sessionCode) {
    return (
      <SessionPickerPanel onOpenSession={(joinCode) => router.push(`/admin?code=${joinCode}`)} />
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
        onAwardBonus={awardBonus}
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
        onAwardBonus={awardBonus}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-7">
        <div className="flex items-center justify-end gap-4 text-sm font-bold">
          <span className="text-foreground/60">{auth.user?.username}</span>
          {auth.user?.role === 'admin' && (
            <Link href="/admin/users" className="underline">
              Users
            </Link>
          )}
          <button type="button" onClick={handleLogout} className="underline">
            Log out
          </button>
        </div>
        {canChooseQuiz && <ImportPanel onImported={refetchQuizzes} />}
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
          displayQuestionId={displayQuestionId}
          displayTitleRoundIndex={displayTitleRoundIndex}
          displayBreakRoundIndex={displayBreakRoundIndex}
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

export default function AdminPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}
