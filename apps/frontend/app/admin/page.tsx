'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  DEFAULT_SESSION_SETTINGS,
  getBlockStartRoundIndex,
  type GameStatus,
  type QuizSummaryRound,
  type QuizzesListedPayload,
} from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { fetchAnswers, AnswerApiError } from '@/app/lib/answer-api';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import { closeSession, SessionApiError } from '@/app/lib/sessions-api';
import { useAuth } from '@/app/lib/use-auth';
import { TeamsTable } from '@/app/admin/teams-table';
import { DesktopSidebar } from '@/app/admin/desktop-sidebar';
import { QuestionBrowserPanel } from '@/app/admin/question-browser-panel';
import { MobileAdminBar } from '@/app/admin/mobile-admin-bar';
import { SessionSettingsPanel } from '@/app/admin/session-settings-panel';
import { useAdminKeyboardShortcuts } from '@/app/admin/use-admin-keyboard-shortcuts';

const EMPTY_ROUNDS: QuizSummaryRound[] = [];

function AdminPageContent() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('code');
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(
    null,
  );
  const [quizzes, setQuizzes] = useState<QuizzesListedPayload | null>(null);

  const isAuthenticated = auth.status === 'authenticated';

  // The code the socket actually connects with. Only adopts `sessionCode`
  // (the URL's ?code=) when it points at a session the socket doesn't
  // already know about — a deep link, a freshly picked session, or a
  // manual URL edit to a different session — so a snapshot that already
  // matches the current session never forces a pointless full socket
  // reconnect (and briefly hides already-correct data behind the
  // "Connecting…" screen).
  const [connectJoinCode, setConnectJoinCode] = useState<string | null>(
    sessionCode,
  );

  const {
    snapshot,
    connectionError,
    sendAction,
    liveAnswers,
    gradeAnswer,
    kickTeam,
    awardBonus,
    setBreakEndTime,
    setLiveAnswers = () => {},
    reconnectedAt,
  } = useGameSocket(
    'admin',
    isAuthenticated && Boolean(connectJoinCode),
    connectJoinCode ?? undefined,
  );
  const connectedJoinCode = snapshot?.joinCode;

  // Adopts a new ?code= only when it points at a session the socket doesn't
  // already know about (see `connectJoinCode` above) — adjusted during
  // render rather than in an Effect, keyed off sessionCode the same way the
  // old Effect's dependency array was. Compares against `connectedJoinCode`
  // (plain state, not a ref) since refs can't be read during render.
  const [prevSessionCode, setPrevSessionCode] = useState(sessionCode);
  if (sessionCode !== prevSessionCode) {
    setPrevSessionCode(sessionCode);
    if (sessionCode && sessionCode !== connectedJoinCode) {
      setConnectJoinCode(sessionCode);
    }
  }

  useEffect(() => {
    // Keeps the URL's ?code= in sync with whatever session the socket is
    // actually connected to, so a refresh lands back in the same session
    // instead of falling through to the picker screen. Pure URL
    // bookkeeping — `connectJoinCode` above deliberately doesn't treat this
    // as a new session to connect to.
    if (snapshot && snapshot.joinCode !== sessionCode) {
      router.replace(`/admin?code=${snapshot.joinCode}`);
    }
  }, [snapshot, sessionCode, router]);

  useEffect(() => {
    // The session picker (list + start) now lives at /sessions — /admin
    // without a ?code= just bounces there instead of rendering it inline.
    if (isAuthenticated && !sessionCode) {
      router.replace('/sessions');
    }
  }, [isAuthenticated, sessionCode, router]);

  const codeFromUrl = searchParams.get('code') ?? undefined;
  useEffect(() => {
    // Only bounces back to the picker for a session that never connected in
    // the first place (e.g. an unknown/invalid ?code=) — handleConnection
    // disconnects before ever sending STATE_SYNC in that case, so snapshot
    // stays null. Once a snapshot exists, a later WsException (illegal
    // transition, the ungraded-answers gate, kick/bonus validation, …) is an
    // action-level rejection on an otherwise-live session — it should render
    // inline via the existing connectionError banner, not redirect away.
    if (codeFromUrl && connectionError && !snapshot) {
      router.replace('/sessions');
    }
  }, [codeFromUrl, connectionError, snapshot, router]);

  useEffect(() => {
    // Login/register/pending-approval now live at /login and /register —
    // anyone landing here without a session bounces there instead of
    // rendering those screens inline.
    if (auth.status === 'unauthenticated' || auth.status === 'pending') {
      router.replace('/login');
    }
  }, [auth.status, router]);

  const gameStatus = snapshot?.progress.status;

  const lastFetchedStatusRef = useRef<GameStatus | undefined>(undefined);
  useEffect(() => {
    // Fetch once on connect (any status) so the question browser has data
    // immediately, then keep refreshing on every lobby/ended visit to pick
    // up re-imports. Keyed off the *transition*, not off `quizzes` itself —
    // depending on `quizzes` here would re-trigger this effect every time
    // its own fetch resolves, since each response is a fresh object even
    // when the quiz list hasn't changed, causing an infinite refetch loop.
    if (!gameStatus || !connectedJoinCode) return;
    const isFirstFetch = lastFetchedStatusRef.current === undefined;
    const enteredChoosableStatus =
      (gameStatus === 'lobby' || gameStatus === 'ended') &&
      lastFetchedStatusRef.current !== gameStatus;
    lastFetchedStatusRef.current = gameStatus;
    if (!isFirstFetch && !enteredChoosableStatus) return;

    // A `cancelled` flag scoped to *this* effect invocation, not a
    // page-wide "is the component still mounted" ref — the latter breaks
    // under React Strict Mode's dev-only mount→cleanup→remount cycle: its
    // cleanup fires once and is never reset back, so every fetch after the
    // very first render is silently discarded and the panel below only
    // ever appears after a manual reload.
    let cancelled = false;
    fetchQuizzes(connectedJoinCode)
      .then((payload) => {
        if (cancelled) return;
        setQuizzes(payload);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(
          error instanceof QuizApiError
            ? error.message
            : 'Could not load quizzes',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [gameStatus, connectedJoinCode]);

  // A newly selected/restarted quiz invalidates any question id picked under
  // the previous session. Adjusted during render rather than in an Effect.
  const [prevConnectedJoinCode, setPrevConnectedJoinCode] =
    useState(connectedJoinCode);
  if (connectedJoinCode !== prevConnectedJoinCode) {
    setPrevConnectedJoinCode(connectedJoinCode);
    setSelectedQuestionId(null);
  }

  const revealIndex = snapshot?.progress.revealIndex ?? 0;
  // Which question the audience is actually looking at right now: the open
  // question while it's open/locking, the block question at `revealIndex`
  // during break (every position shows its own content, including the
  // block's last, just-locked question), or the reveal question at
  // `revealIndex` once the reveal walk starts.
  const displayQuestionId =
    gameStatus === 'question_open' || gameStatus === 'locking'
      ? (snapshot?.currentQuestion?.id ?? null)
      : gameStatus === 'break'
        ? (snapshot?.blockQuestions?.[revealIndex]?.id ?? null)
        : gameStatus === 'reveal'
          ? (snapshot?.revealQuestions?.[revealIndex]?.id ?? null)
          : null;
  // round_intro/reveal_intro/break_round_intro show a round's title card
  // instead of a question — no question id exists to mark on-display, so the
  // browser instead marks that round's "T" indicator. reveal_intro's and
  // break_round_intro's round comes from the block question at the
  // crossed-into position (progress.roundIndex stays pinned to the block's
  // last round throughout break/reveal, so it can't be used here);
  // round_intro's round is progress.roundIndex itself.
  const revealIntroRoundNumber =
    snapshot?.revealQuestions?.[revealIndex]?.roundNumber;
  const breakRoundIntroRoundNumber =
    snapshot?.blockQuestions?.[revealIndex]?.roundNumber;
  const displayTitleRoundIndex =
    gameStatus === 'round_intro'
      ? (snapshot?.progress.roundIndex ?? null)
      : gameStatus === 'reveal_intro' && revealIntroRoundNumber !== undefined
        ? revealIntroRoundNumber - 1
        : gameStatus === 'break_round_intro' &&
            breakRoundIntroRoundNumber !== undefined
          ? breakRoundIntroRoundNumber - 1
          : null;
  // progress.roundIndex is the breakAfter round whose block just finished,
  // so the "B" indicator on that round's row lights up for the whole break,
  // including its entry beat and round-title pauses.
  const displayBreakRoundIndex =
    gameStatus === 'break_intro' ||
    gameStatus === 'break' ||
    gameStatus === 'break_round_intro'
      ? (snapshot?.progress.roundIndex ?? null)
      : null;
  // Grading defaults to whatever's on display, but a manual pick from the
  // browser sticks — until Prev/Advance brings the displayed question back
  // around to match it, at which point the sync check below drops the
  // override so the two keep moving together again instead of the pick
  // going stale. Outside display statuses, grading still needs *something*
  // to default to, so it falls back to the block's first question —
  // naturally null wherever blockQuestions is empty (e.g. round_intro).
  const defaultBlockQuestionId = snapshot?.blockQuestions?.[0]?.id ?? null;
  // Adjusted during render rather than in an Effect — once selectedQuestionId
  // is nulled, this condition is false on the next render, so it can't loop.
  if (selectedQuestionId !== null && selectedQuestionId === displayQuestionId) {
    setSelectedQuestionId(null);
  }
  const effectiveQuestionId =
    selectedQuestionId ?? displayQuestionId ?? defaultBlockQuestionId;

  useEffect(() => {
    // `liveAnswers` is transient, request-driven data — it isn't part of the
    // STATE_SYNC snapshot the server resends automatically on reconnect, so
    // `reconnectedAt` is included here to re-fetch it after a dropped
    // connection recovers (e.g. a phone/laptop losing Wi-Fi mid-grading).
    const joinCode = snapshot?.joinCode;
    if (!joinCode || effectiveQuestionId === null) return;
    let cancelled = false;
    fetchAnswers(joinCode, effectiveQuestionId)
      .then((payload) => {
        if (cancelled) return;
        setLiveAnswers(payload);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(
          error instanceof AnswerApiError
            ? error.message
            : 'Could not load answers',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot?.joinCode, effectiveQuestionId, setLiveAnswers, reconnectedAt]);

  const activeQuizId = quizzes?.activeQuizId ?? null;
  const activeQuizTitle =
    quizzes?.quizzes.find((quiz) => quiz.id === activeQuizId)?.title ?? null;
  const activeQuizRounds =
    quizzes?.quizzes.find((quiz) => quiz.id === activeQuizId)?.rounds ??
    EMPTY_ROUNDS;
  const roundTitles = useMemo(
    () => activeQuizRounds.map((round) => round.title),
    [activeQuizRounds],
  );

  function handleCloseSession(): void {
    if (!snapshot) return;
    closeSession(snapshot.joinCode)
      .then(() => {
        router.push('/sessions');
      })
      .catch((error: unknown) => {
        toast.error(
          error instanceof SessionApiError
            ? error.message
            : 'Could not close session',
        );
      });
  }

  function handleLogout(): void {
    auth.logout();
    router.push('/');
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
    gameStatus === 'break_round_intro' ||
    gameStatus === 'reveal_intro' ||
    gameStatus === 'reveal';
  const canGoToPreviousQuestion =
    gameStatus === 'round_intro' ||
    gameStatus === 'question_open' ||
    gameStatus === 'locking' ||
    // 'reveal', 'reveal_intro', 'break', and 'break_intro' always have
    // somewhere to go back to — 'break_intro' reveals the just-locked
    // question, 'break' now always pauses on a round's own title card
    // (break_round_intro) before ever needing to cross a block boundary, and
    // 'reveal_intro' just re-enters that same block's break, always legal on
    // its own. Only 'break_round_intro' can hit the true start of the quiz's
    // reveal history (walking a title card backward past the block's first
    // question, with no earlier block to cross into), where Previous has
    // nothing left to do.
    gameStatus === 'reveal' ||
    gameStatus === 'reveal_intro' ||
    gameStatus === 'break_intro' ||
    gameStatus === 'break' ||
    (gameStatus === 'break_round_intro' &&
      (revealIndex > 0 || activeBlockStartIndex > 0));
  const hasUnrevealedTeams =
    isLeaderboardVisible && leaderboardRevealCount < leaderboardTeamCount;

  useAdminKeyboardShortcuts({
    canAdvance,
    canGoToPreviousQuestion,
    hasUnrevealedTeams,
    isLeaderboardVisible,
    sendAction,
  });

  if (
    auth.status === 'checking' ||
    auth.status === 'unauthenticated' ||
    auth.status === 'pending'
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }

  if (!sessionCode) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
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
    teams = [],
    answeredTeamIds = [],
    ungradedQuestionIds = [],
    breakEndsAt = null,
    settings = DEFAULT_SESSION_SETTINGS,
  } = snapshot;
  const fallbackQuestions = currentQuestion
    ? [currentQuestion, ...blockQuestions]
    : blockQuestions;
  const showAnswerStatus =
    progress.status === 'question_open' || progress.status === 'locking';
  const canEndQuiz = progress.status !== 'ended';
  const canCloseSession = progress.status === 'ended';

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <MobileAdminBar
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
        canCloseSession={canCloseSession}
        isLeaderboardVisible={progress.isLeaderboardVisible}
        leaderboardRevealCount={leaderboardRevealCount}
        leaderboardTeamCount={leaderboard.length}
        onAction={sendAction}
        onCloseSession={handleCloseSession}
        teams={teams}
        showAnswerStatus={showAnswerStatus}
        answeredTeamIds={answeredTeamIds}
        onKickTeam={kickTeam}
        breakEndsAt={breakEndsAt}
        onSetBreakEndTime={setBreakEndTime}
        user={auth.user}
        onLogout={handleLogout}
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
        canCloseSession={canCloseSession}
        isLeaderboardVisible={progress.isLeaderboardVisible}
        leaderboardRevealCount={leaderboardRevealCount}
        leaderboardTeamCount={leaderboard.length}
        onAction={sendAction}
        onCloseSession={handleCloseSession}
        teams={teams}
        showAnswerStatus={showAnswerStatus}
        answeredTeamIds={answeredTeamIds}
        onKickTeam={kickTeam}
        breakEndsAt={breakEndsAt}
        onSetBreakEndTime={setBreakEndTime}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        {progress.status === 'lobby' && (
          <SessionSettingsPanel
            joinCode={snapshot.joinCode}
            settings={settings}
          />
        )}
        {progress.status !== 'lobby' && (
          <>
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
              ungradedQuestionIds={ungradedQuestionIds}
            />
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl">Teams</h2>
              <TeamsTable
                teams={teams}
                leaderboard={leaderboard}
                roundTitles={roundTitles}
                onAwardBonus={awardBonus}
                enabledBonusCategories={settings.enabledBonusCategories}
              />
            </section>
          </>
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
