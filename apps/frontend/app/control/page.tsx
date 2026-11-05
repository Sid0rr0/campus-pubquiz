'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type AdminIndicators,
  type GameStatus,
  type QuizSummaryRound,
} from '@campus-pubquiz/types';
import { useAdminSession } from '@/app/lib/use-admin-session';
import { fetchAnswers, AnswerApiError } from '@/app/lib/answer-api';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import { closeSession, SessionApiError } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { useToastOnError } from '@/app/lib/use-toast-on-error';
import { TeamsTable } from '@/app/control/teams-table';
import { DesktopSidebar } from '@/app/control/desktop-sidebar';
import { AnswersPanel } from '@/app/control/answers-panel';
import { QuestionBrowserPanel } from '@/app/control/question-browser-panel';
import { QuestionDetail } from '@/app/control/question-detail';
import {
  RoundCardDetail,
  titleCardKindLabel,
} from '@/app/control/round-card-detail';
import {
  isSameItem,
  onAirItem,
  type DetailItem,
} from '@/app/control/detail-item';
import { MobileAdminBar } from '@/app/control/mobile-admin-bar';
import { SessionSettingsPanel } from '@/app/control/session-settings-panel';
import type { ControlPanel } from '@/app/control/control-panel';
import { useAdminKeyboardShortcuts } from '@/app/control/use-admin-keyboard-shortcuts';

const EMPTY_ROUNDS: QuizSummaryRound[] = [];
const NO_INDICATORS: AdminIndicators = {
  onDisplayQuestionId: null,
  titleCardRoundIndex: null,
  breakRoundIndex: null,
};

type AdminSession = ReturnType<typeof useAdminSession>;
type AdminSnapshot = AdminSession['snapshot'];

/** The quiz the session is running, from the quiz list (null until it loads). */
function activeQuizOf(
  quizzes: Awaited<ReturnType<typeof fetchQuizzes>> | null,
) {
  const id = quizzes?.activeQuizId ?? null;
  const quiz = quizzes?.quizzes.find((candidate) => candidate.id === id);
  return {
    id,
    title: quiz?.title ?? null,
    rounds: quiz?.rounds ?? EMPTY_ROUNDS,
  };
}

/**
 * The detail column's item: a manual pick from the browser, else what's on
 * air, else the block's first question (none outside a block).
 */
function effectiveItemOf(
  selectedItem: DetailItem | null,
  onAir: DetailItem | null,
  firstBlockQuestionId: number | null,
): DetailItem | null {
  if (selectedItem) return selectedItem;
  if (onAir) return onAir;
  return firstBlockQuestionId === null
    ? null
    : { kind: 'question', questionId: firstBlockQuestionId };
}

/**
 * What the keyboard shortcuts can do, as decided by the server (the admin
 * view). With no view yet there is nothing to act on, hence the fallbacks.
 */
function shortcutStateOf(snapshot: AdminSnapshot) {
  const controls = snapshot?.controlAvailability;
  return {
    advanceStep: snapshot?.advanceStep ?? 'none',
    previousState: snapshot?.previousState ?? 'unavailable',
    isLeaderboardVisible: snapshot?.progress.isLeaderboardVisible ?? false,
    canToggleJoinOverlay: controls?.canToggleJoinOverlay ?? false,
    canPauseMedia: controls?.canPauseMedia ?? false,
    isDisplaySoundMuted: snapshot?.isDisplaySoundMuted ?? false,
  } as const;
}

function AdminPageContent() {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<DetailItem | null>(null);
  const queryClient = useQueryClient();

  const {
    snapshot,
    connectionError,
    sendAction,
    liveAnswers,
    gradeAnswer,
    kickTeam,
    setTeamPlayerCount,
    setTeamJoker,
    awardBonus,
    setBreakEndTime,
    setDisplayTextScale,
    setDisplaySoundMuted,
    createShowdownRound,
    setLiveAnswers,
    focusAnswersQuestionId,
    reconnectedAt,
    auth,
    isLoading,
  } = useAdminSession('/control');
  const connectedJoinCode = snapshot?.joinCode;

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
    setSelectedItem(null);
  }

  // What the big screen is showing was resolved by the server (the admin
  // view): the question on display, the round whose title card is up, and
  // the round whose break indicator is lit.
  const indicators = snapshot ?? NO_INDICATORS;
  const onAir = onAirItem(indicators);
  // The detail column shows whatever's on air, but a manual pick from the
  // browser sticks — until Prev/Advance brings the big screen onto the picked
  // item, at which point the sync check below drops the override so the two
  // keep moving together again instead of the pick going stale. With nothing
  // on air, it falls back to the block's first question — naturally null
  // wherever blockQuestions is empty (e.g. round_intro).
  // Adjusted during render rather than in an Effect — once selectedItem
  // is nulled, this condition is false on the next render, so it can't loop.
  if (isSameItem(selectedItem, onAir)) {
    setSelectedItem(null);
  }
  const effectiveItem = effectiveItemOf(
    selectedItem,
    onAir,
    snapshot?.blockQuestions[0]?.id ?? null,
  );
  const effectiveQuestionId =
    effectiveItem?.kind === 'question' ? effectiveItem.questionId : null;

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

  const {
    id: activeQuizId,
    title: activeQuizTitle,
    rounds: activeQuizRounds,
  } = activeQuizOf(quizzes);

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

  // This hook runs before the null-snapshot early return below.
  useAdminKeyboardShortcuts({
    ...shortcutStateOf(snapshot),
    sendAction,
    setDisplaySoundMuted,
  });

  if (isLoading) {
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

  const { progress, settings } = snapshot;
  const panel: ControlPanel = {
    view: snapshot,
    quiz: { id: activeQuizId, title: activeQuizTitle },
    connectionError,
    controls: snapshot.controlAvailability,
    actions: {
      sendAction,
      kickTeam,
      setTeamPlayerCount,
      setTeamJoker,
      setBreakEndTime,
      setDisplayTextScale,
      setDisplaySoundMuted,
      createShowdownRound,
      closeSession: handleCloseSession,
    },
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <MobileAdminBar panel={panel} user={auth.user} onLogout={handleLogout} />
      <DesktopSidebar panel={panel} />
      <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 pt-0">
        {progress.status === 'lobby' && (
          <SessionSettingsPanel
            joinCode={snapshot.joinCode}
            settings={settings}
          />
        )}
        {progress.status !== 'lobby' && (
          <SessionWorkspace
            view={snapshot}
            rounds={activeQuizRounds}
            item={effectiveItem}
            questionId={effectiveQuestionId}
            isManualPick={selectedItem !== null}
            indicators={indicators}
            onSelect={setSelectedItem}
            liveAnswers={liveAnswers}
            onGrade={gradeAnswer}
            onAwardBonus={awardBonus}
          />
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

/** The control page below the sidebar once the quiz has left the lobby. */
function SessionWorkspace({
  view,
  rounds,
  item,
  questionId,
  isManualPick,
  indicators,
  onSelect,
  liveAnswers,
  onGrade,
  onAwardBonus,
}: {
  view: NonNullable<AdminSnapshot>;
  rounds: typeof EMPTY_ROUNDS;
  item: DetailItem | null;
  questionId: number | null;
  isManualPick: boolean;
  indicators: AdminIndicators;
  onSelect: (item: DetailItem | null) => void;
  liveAnswers: AdminSession['liveAnswers'];
  onGrade: AdminSession['gradeAnswer'];
  onAwardBonus: AdminSession['awardBonus'];
}) {
  const {
    progress,
    currentQuestion,
    activeBlockStartIndex,
    blockQuestions,
    leaderboard,
    roundTitles,
    teams,
    ungradedQuestionIds,
    settings,
  } = view;
  const fallbackQuestions = currentQuestion
    ? [currentQuestion, ...blockQuestions]
    : blockQuestions;
  return (
    <>
      <>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="md:max-w-[60%] md:flex-none">
            <QuestionBrowserPanel
              rounds={rounds}
              currentRoundIndex={progress.roundIndex}
              activeBlockStartIndex={activeBlockStartIndex}
              selected={item}
              indicators={indicators}
              onSelect={onSelect}
              ungradedQuestionIds={ungradedQuestionIds}
            />
          </div>
          <div className="md:min-w-0 md:flex-1">
            {item && item.kind !== 'question' ? (
              <RoundCardDetail
                item={item}
                rounds={rounds}
                kindLabel={
                  !isManualPick
                    ? titleCardKindLabel(progress.status)
                    : undefined
                }
              />
            ) : (
              <QuestionDetail
                questionId={questionId}
                rounds={rounds}
                liveAnswers={liveAnswers}
                fallbackQuestions={fallbackQuestions}
              />
            )}
          </div>
        </div>
        {liveAnswers && liveAnswers.questionId === questionId && (
          <AnswersPanel
            liveAnswers={liveAnswers}
            teams={teams}
            onGrade={onGrade}
          />
        )}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Teams</h2>
          <TeamsTable
            joinCode={view.joinCode}
            leaderboard={leaderboard}
            roundTitles={roundTitles}
            onAwardBonus={onAwardBonus}
            enabledBonusCategories={settings.enabledBonusCategories}
            coinsByTeamId={
              settings.powerUpsEnabled
                ? Object.fromEntries(
                    teams.map((team) => [team.teamId, team.coins]),
                  )
                : undefined
            }
          />
        </section>
      </>
    </>
  );
}
