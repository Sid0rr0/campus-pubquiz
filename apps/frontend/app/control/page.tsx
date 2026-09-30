'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEFAULT_DISPLAY_TEXT_SCALE,
  DEFAULT_SESSION_SETTINGS,
  getTiedForFirst,
  isBreakPointQuestion,
  getLeaderboardRevealStepCount,
  type GameStatus,
  type QuizSummaryRound,
} from '@campus-pubquiz/types';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { useLockCountdownSound } from '@/app/lib/use-lock-countdown-sound';
import { fetchAnswers, AnswerApiError } from '@/app/lib/answer-api';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import { closeSession, SessionApiError } from '@/app/lib/sessions-api';
import { useAuth } from '@/app/lib/use-auth';
import { isYoutubeMediaUrl } from '@/app/display/question-display';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { useToastOnError } from '@/app/lib/use-toast-on-error';
import { EnableSoundButton } from '@/app/components/enable-sound-button';
import { TeamsTable } from '@/app/control/teams-table';
import { DesktopSidebar } from '@/app/control/desktop-sidebar';
import { QuestionBrowserPanel } from '@/app/control/question-browser-panel';
import { PhaseTimer } from '@/app/control/phase-timer';
import { MobileAdminBar } from '@/app/control/mobile-admin-bar';
import { SessionSettingsPanel } from '@/app/control/session-settings-panel';
import { useAdminKeyboardShortcuts } from '@/app/control/use-admin-keyboard-shortcuts';

const EMPTY_ROUNDS: QuizSummaryRound[] = [];

// Mirrors the backend's block-grading GRADED_STATUSES (see
// block-grading.service.ts) — the window in which ungradedQuestionIds is
// kept fresh, so it's safe to trust "grading complete" from that point on.
const SHOWDOWN_ELIGIBLE_STATUSES: GameStatus[] = [
  'break_intro',
  'break',
  'break_round_intro',
  'reveal_intro',
  'reveal',
  'ended',
];

function AdminPageContent() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('code');
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(
    null,
  );
  const queryClient = useQueryClient();

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
    setDisplayTextScale,
    createShowdownRound,
    setLiveAnswers = () => {},
    focusAnswersQuestionId = () => {},
    reconnectedAt,
  } = useGameSocket(
    'admin',
    isAuthenticated && Boolean(connectJoinCode),
    connectJoinCode ?? undefined,
  );
  const { needsUnlock: needsSoundUnlock, unlock: unlockSound } =
    useLockCountdownSound({
      lockAt: snapshot?.questionLockAt ?? null,
      enabled:
        snapshot?.settings?.playLockCountdownSound ??
        DEFAULT_SESSION_SETTINGS.playLockCountdownSound,
    });
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
      router.replace(`/control?code=${snapshot.joinCode}`);
    }
  }, [snapshot, sessionCode, router]);

  useEffect(() => {
    // The session picker (list + start) now lives at /sessions — /control
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

  const quizzesQuery = useQuery({
    queryKey: queryKeys.quizzes.list(connectedJoinCode),
    queryFn: () => fetchQuizzes(connectedJoinCode as string),
    enabled: Boolean(connectedJoinCode),
  });
  const quizzes = quizzesQuery.data ?? null;
  useToastOnError(
    apiErrorMessage(quizzesQuery.error, QuizApiError, 'Could not load quizzes'),
  );

  const previousGameStatusRef = useRef<GameStatus | undefined>(undefined);
  useEffect(() => {
    // Fetch-on-connect is the query's own job now (it fires as soon as
    // `connectedJoinCode` makes it enabled). This only handles the
    // "re-entered a choosable status, re-read the quiz list to pick up
    // re-imports" case, keyed off the *transition* so a snapshot broadcast
    // that doesn't change status is a no-op.
    const previous = previousGameStatusRef.current;
    previousGameStatusRef.current = gameStatus;
    const enteredChoosableStatus =
      previous !== undefined &&
      previous !== gameStatus &&
      (gameStatus === 'lobby' || gameStatus === 'ended');
    if (!enteredChoosableStatus) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.quizzes.list(connectedJoinCode),
    });
  }, [gameStatus, connectedJoinCode, queryClient]);

  // A newly selected/restarted quiz invalidates any question id picked under
  // the previous session. Adjusted during render rather than in an Effect.
  const [prevConnectedJoinCode, setPrevConnectedJoinCode] =
    useState(connectedJoinCode);
  if (connectedJoinCode !== prevConnectedJoinCode) {
    setPrevConnectedJoinCode(connectedJoinCode);
    setSelectedQuestionId(null);
  }

  // What the big screen is showing was resolved by the server (the admin
  // view): the question on display, the round whose title card is up, and
  // the round whose break indicator is lit.
  const displayQuestionId = snapshot?.onDisplayQuestionId ?? null;
  const displayTitleRoundIndex = snapshot?.titleCardRoundIndex ?? null;
  const displayBreakRoundIndex = snapshot?.breakRoundIndex ?? null;
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

  const answersJoinCode = snapshot?.joinCode;
  const answersQuery = useQuery({
    queryKey: queryKeys.answers.forQuestion(
      answersJoinCode ?? '',
      effectiveQuestionId ?? -1,
    ),
    queryFn: () =>
      fetchAnswers(answersJoinCode as string, effectiveQuestionId as number),
    enabled: Boolean(answersJoinCode) && effectiveQuestionId !== null,
    // Transient, request-driven data — never serve a previous block's
    // answers from cache, and don't keep them around once the admin moves
    // on to a different question.
    gcTime: 0,
  });
  useToastOnError(
    apiErrorMessage(
      answersQuery.error,
      AnswerApiError,
      'Could not load answers',
    ),
  );

  useEffect(() => {
    // Folds the REST load into the same state slot the live ANSWERS_UPDATED
    // broadcasts (SUBMIT_ANSWER/GRADE_ANSWER) already write to.
    if (!answersQuery.data) return;
    setLiveAnswers(answersQuery.data);
  }, [answersQuery.data, setLiveAnswers]);

  useEffect(() => {
    // Keeps the socket from folding a live ANSWERS_UPDATED broadcast for a
    // different question (e.g. a team answering the still-open current
    // question while the admin browses an earlier one to grade it) into
    // `liveAnswers` — without this, that broadcast replaces the answers
    // panel's data with the wrong question's, which then fails the
    // `liveAnswers.questionId === selectedQuestionId` check below and makes
    // the whole grading panel disappear until something else refreshes it.
    focusAnswersQuestionId(effectiveQuestionId);
  }, [effectiveQuestionId, focusAnswersQuestionId]);

  useEffect(() => {
    // `liveAnswers` isn't part of the STATE_SYNC snapshot the server resends
    // on reconnect, so a dropped connection has to re-trigger this read
    // explicitly (e.g. a phone/laptop losing Wi-Fi mid-grading). Invalidating
    // — rather than folding `reconnectedAt` into the query key — avoids
    // minting a new cache entry per reconnect.
    if (reconnectedAt === null) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.answers.all });
  }, [reconnectedAt, queryClient]);

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

  const closeSessionMutation = useMutation({
    mutationFn: (joinCode: string) => closeSession(joinCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      router.push('/sessions');
    },
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, SessionApiError, 'Could not close session') ??
          'Could not close session',
      ),
  });

  function handleCloseSession(): void {
    if (!snapshot) return;
    closeSessionMutation.mutate(snapshot.joinCode);
  }

  function handleLogout(): void {
    auth.logout();
    router.push('/');
  }

  const roundIndex = snapshot?.progress.roundIndex ?? 0;
  const isLeaderboardVisible = snapshot?.progress.isLeaderboardVisible ?? false;
  // Reveal steps, not teams: tied teams share a rank and appear together in
  // one step, and a kahootMode round only reveals through its top 5 — same
  // cutoff the display enforces via maxRank — so "Show Next Team" switches
  // to "Hide Leaderboard" once every distinct rank on screen is shown.
  const leaderboardTeamCount = getLeaderboardRevealStepCount(
    snapshot?.leaderboard ?? [],
    snapshot?.isCurrentRoundKahoot ?? false,
  );
  const leaderboardRevealCount = snapshot?.leaderboardRevealCount ?? 0;
  const gameContext = {
    rounds: activeQuizRounds.map((round) => ({
      questionCount: round.questions.length,
      breakAfter: round.breakAfter,
      kahootMode: round.kahootMode,
    })),
  };
  // Where the active block starts, and whether Advance/Previous are
  // accepted right now, are decided by the server (the admin view) from the
  // session's own rounds and the same steps the action handler applies.
  const activeBlockStartIndex = snapshot?.activeBlockStartIndex ?? 0;
  const canStartQuiz = gameStatus === 'lobby';
  const canAdvance = snapshot?.canAdvance ?? false;
  const canGoToPreviousQuestion = snapshot?.canGoToPreviousQuestion ?? false;
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
    displayTextScale = DEFAULT_DISPLAY_TEXT_SCALE,
    phaseStartedAt = null,
    phaseElapsedMs = null,
    settings = DEFAULT_SESSION_SETTINGS,
    activeShowdown = null,
  } = snapshot;
  const tiedTeamNames = getTiedForFirst(leaderboard).map(
    (entry) => entry.teamName,
  );
  // The admin can compose/save the tiebreaker question as soon as the final
  // block is graded — no need to wait through the block's own reveal walk
  // to reach 'ended'. Gated on the final round specifically (not just any
  // grading break) so a coincidental mid-quiz tie for 1st never offers it
  // early.
  const isShowdownEligible =
    activeQuizRounds.length > 0 &&
    roundIndex >= activeQuizRounds.length - 1 &&
    ungradedQuestionIds.length === 0 &&
    SHOWDOWN_ELIGIBLE_STATUSES.includes(progress.status);
  const fallbackQuestions = currentQuestion
    ? [currentQuestion, ...blockQuestions]
    : blockQuestions;
  const showAnswerStatus =
    progress.status === 'question_open' || progress.status === 'locking';
  const canEndQuiz = progress.status !== 'ended';
  const canCloseSession = progress.status === 'ended';
  // currentQuestion (and with it its own media) is only populated while a
  // question is actually open on /display — see getCurrentQuestion.
  const canReplayMedia =
    progress.status === 'question_open' &&
    isYoutubeMediaUrl(currentQuestion?.mediaUrl);
  // Lets the admin pre-set the break end-time while still on the block's
  // last question, so it's already in place once the break screen appears —
  // see BreakEndTimeControl.
  const isLastQuestionBeforeBreak =
    activeQuizRounds.length > roundIndex &&
    showAnswerStatus &&
    isBreakPointQuestion(
      progress.roundIndex,
      progress.questionIndex,
      gameContext,
    );

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      {needsSoundUnlock && <EnableSoundButton onClick={unlockSound} />}
      <MobileAdminBar
        progressStatus={progress.status}
        roundIndex={progress.roundIndex}
        questionIndex={progress.questionIndex}
        joinCode={snapshot.joinCode}
        activeQuizId={activeQuizId}
        activeQuizTitle={activeQuizTitle}
        connectionError={connectionError}
        canStartQuiz={canStartQuiz}
        canGoToPreviousQuestion={canGoToPreviousQuestion}
        canAdvance={canAdvance}
        canEndQuiz={canEndQuiz}
        canCloseSession={canCloseSession}
        isLeaderboardVisible={progress.isLeaderboardVisible}
        leaderboardRevealCount={leaderboardRevealCount}
        leaderboardTeamCount={leaderboardTeamCount}
        isMediaFullscreen={progress.isMediaFullscreen ?? false}
        canReplayMedia={canReplayMedia}
        onAction={sendAction}
        onCloseSession={handleCloseSession}
        teams={teams}
        showAnswerStatus={showAnswerStatus}
        answeredTeamIds={answeredTeamIds}
        onKickTeam={kickTeam}
        breakEndsAt={breakEndsAt}
        onSetBreakEndTime={setBreakEndTime}
        isLastQuestionBeforeBreak={isLastQuestionBeforeBreak}
        displayTextScale={displayTextScale}
        onSetDisplayTextScale={setDisplayTextScale}
        activeShowdown={activeShowdown}
        tiedTeamNames={tiedTeamNames}
        isShowdownEligible={isShowdownEligible}
        onCreateShowdownRound={createShowdownRound}
        user={auth.user}
        onLogout={handleLogout}
      />
      <DesktopSidebar
        progressStatus={progress.status}
        roundIndex={progress.roundIndex}
        questionIndex={progress.questionIndex}
        joinCode={snapshot.joinCode}
        activeQuizId={activeQuizId}
        activeQuizTitle={activeQuizTitle}
        connectionError={connectionError}
        canStartQuiz={canStartQuiz}
        canGoToPreviousQuestion={canGoToPreviousQuestion}
        canAdvance={canAdvance}
        canEndQuiz={canEndQuiz}
        canCloseSession={canCloseSession}
        isLeaderboardVisible={progress.isLeaderboardVisible}
        leaderboardRevealCount={leaderboardRevealCount}
        leaderboardTeamCount={leaderboardTeamCount}
        isMediaFullscreen={progress.isMediaFullscreen ?? false}
        canReplayMedia={canReplayMedia}
        onAction={sendAction}
        onCloseSession={handleCloseSession}
        teams={teams}
        showAnswerStatus={showAnswerStatus}
        answeredTeamIds={answeredTeamIds}
        onKickTeam={kickTeam}
        breakEndsAt={breakEndsAt}
        onSetBreakEndTime={setBreakEndTime}
        isLastQuestionBeforeBreak={isLastQuestionBeforeBreak}
        displayTextScale={displayTextScale}
        onSetDisplayTextScale={setDisplayTextScale}
        activeShowdown={activeShowdown}
        tiedTeamNames={tiedTeamNames}
        isShowdownEligible={isShowdownEligible}
        onCreateShowdownRound={createShowdownRound}
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
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <div className="md:min-w-0 md:flex-1">
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
              </div>
              <PhaseTimer
                phaseStartedAt={phaseStartedAt}
                phaseElapsedMs={phaseElapsedMs}
              />
            </div>
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl">Teams</h2>
              <TeamsTable
                joinCode={snapshot.joinCode}
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
