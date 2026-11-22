'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  type AdminIndicators,
  type GameStatus,
  type QuizSummaryRound,
  coinsShown,
} from '@campus-pubquiz/types';
import { useAdminSession } from '@/app/lib/use-admin-session';
import { useAnswerList } from '@/app/lib/use-answer-list';
import { fetchQuizzes, QuizApiError } from '@/app/lib/quiz-api';
import { closeSession, SessionApiError } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { useToastOnError } from '@/app/lib/use-toast-on-error';
import { ClueStatus } from '@/app/control/clue-status';
import { TeamsTable } from '@/app/control/teams-table';
import { SideBar } from '@/app/components/side-bar';
import { DesktopSidebar } from '@/app/control/desktop-sidebar';
import { AnswersPanel } from '@/app/control/answers-panel';
import { QuestionBrowserPanel } from '@/app/control/question-browser-panel';
import { QuestionDetail } from '@/app/control/question-detail';
import {
  BlockBoardCard,
  LeaderboardCard,
} from '@/app/control/leaderboard-card';
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
type AnswerList = ReturnType<typeof useAnswerList>;

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
const NO_SHORTCUT_STATE = {
  advanceStep: 'none',
  previousState: 'unavailable',
  isLeaderboardVisible: false,
  canToggleJoinOverlay: false,
  canPauseMedia: false,
  isDisplaySoundMuted: false,
} as const;

function shortcutStateOf(snapshot: AdminSnapshot) {
  if (!snapshot) return NO_SHORTCUT_STATE;
  const controls = snapshot.controlAvailability;
  return {
    advanceStep: snapshot.advanceStep,
    previousState: snapshot.previousState,
    isLeaderboardVisible: snapshot.progress.isLeaderboardVisible,
    canToggleJoinOverlay: controls.canToggleJoinOverlay,
    canPauseMedia: controls.canPauseMedia,
    isDisplaySoundMuted: snapshot.isDisplaySoundMuted,
  } as const;
}

function AdminPageContent() {
  const router = useRouter();
  const {
    snapshot,
    connectionError,
    sendAction,
    gradeAnswer,
    kickTeam,
    setTeamPlayerCount,
    setTeamSide,
    setTeamJoker,
    awardBonus,
    setBreakEndTime,
    setDisplayTextScale,
    setDisplaySoundMuted,
    createShowdownRound,
    auth,
    isLoading,
  } = useAdminSession('/control');
  const quizzes = useControlQuizzes(snapshot);
  const detail = useDetailItem(snapshot);
  const answerList = useAnswerList(snapshot?.joinCode, detail.questionId);
  const {
    id: activeQuizId,
    title: activeQuizTitle,
    rounds: activeQuizRounds,
  } = activeQuizOf(quizzes);
  const handleCloseSession = useCloseSession(snapshot);

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

  if (isLoading || !snapshot) {
    return (
      <ControlNotReadyScreen
        isLoading={isLoading}
        connectionError={connectionError}
      />
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
      setTeamSide,
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
        {progress.status === 'lobby' ? (
          <SessionSettingsPanel
            joinCode={snapshot.joinCode}
            settings={settings}
            mode={snapshot.quizMode}
          />
        ) : (
          <SessionWorkspace
            view={snapshot}
            rounds={activeQuizRounds}
            item={detail.item}
            questionId={detail.questionId}
            isManualPick={detail.isManualPick}
            indicators={detail.indicators}
            onSelect={detail.select}
            answerList={answerList}
            onGrade={gradeAnswer}
            onAwardBonus={awardBonus}
          />
        )}
      </div>
    </main>
  );
}

function ControlNotReadyScreen({
  isLoading,
  connectionError,
}: {
  isLoading: boolean;
  connectionError: string | null;
}) {
  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-display text-xl">Loading…</p>
      </main>
    );
  }
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

/** The session's quizzes, re-read whenever the session re-enters a status where a quiz can be chosen. */
function useControlQuizzes(snapshot: AdminSnapshot) {
  const queryClient = useQueryClient();
  const connectedJoinCode = snapshot?.joinCode;
  const gameStatus = snapshot?.progress.status;
  const quizzesQuery = useQuery({
    queryKey: queryKeys.quizzes.list(connectedJoinCode),
    queryFn: () => fetchQuizzes(connectedJoinCode as string),
    enabled: Boolean(connectedJoinCode),
  });
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
    if (!isChoosableStatusEntered(previous, gameStatus)) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.quizzes.list(connectedJoinCode),
    });
  }, [gameStatus, connectedJoinCode, queryClient]);
  return quizzesQuery.data ?? null;
}

function isChoosableStatusEntered(
  previous: GameStatus | undefined,
  current: GameStatus | undefined,
): boolean {
  return (
    previous !== undefined &&
    previous !== current &&
    (current === 'lobby' || current === 'ended')
  );
}

/** The item the detail column shows: a manual pick from the browser, else what's on air, else the block's first question. */
function useDetailItem(snapshot: AdminSnapshot) {
  const [selectedItem, setSelectedItem] = useState<DetailItem | null>(null);
  const connectedJoinCode = snapshot?.joinCode;
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
  const item = effectiveItemOf(
    selectedItem,
    onAir,
    snapshot?.blockQuestions[0]?.id ?? null,
  );
  return {
    item,
    questionId: item?.kind === 'question' ? item.questionId : null,
    isManualPick: selectedItem !== null,
    indicators,
    select: setSelectedItem,
  };
}

/** Closes the session and goes back to the session picker. */
function useCloseSession(snapshot: AdminSnapshot) {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  return function handleCloseSession(): void {
    if (!snapshot) return;
    closeSessionMutation.mutate(snapshot.joinCode);
  };
}

export default function AdminPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <AdminPageContent />
    </Suspense>
  );
}

/** The live leaderboard card or a block's 🏆 board for the item, else null. */
function rankBoardCard(
  view: NonNullable<AdminSnapshot>,
  item: DetailItem | null,
) {
  if (item?.kind === 'leaderboard' && view.liveRankBoard) {
    return <LeaderboardCard board={view.liveRankBoard} />;
  }
  if (item?.kind !== 'blockBoard') return null;
  const board = view.blockBoards.find((b) => b.roundIndex === item.roundIndex);
  return board?.isReached ? <BlockBoardCard board={board} /> : null;
}

/** The detail column: the live leaderboard card, a title or break card, or a question. */
function DetailPane({
  view,
  rounds,
  item,
  questionId,
  isManualPick,
  answerList,
}: {
  view: NonNullable<AdminSnapshot>;
  rounds: typeof EMPTY_ROUNDS;
  item: DetailItem | null;
  questionId: number | null;
  isManualPick: boolean;
  answerList: AnswerList;
}) {
  const boardCard = rankBoardCard(view, item);
  if (boardCard) return boardCard;
  if (item && (item.kind === 'title' || item.kind === 'break')) {
    return (
      <RoundCardDetail
        item={item}
        rounds={rounds}
        kindLabel={
          !isManualPick ? titleCardKindLabel(view.progress.status) : undefined
        }
      />
    );
  }
  return (
    <QuestionPane
      view={view}
      rounds={rounds}
      questionId={questionId}
      answerList={answerList}
    />
  );
}

function QuestionPane({
  view: { currentQuestion, blockQuestions },
  rounds,
  questionId,
  answerList,
}: {
  view: NonNullable<AdminSnapshot>;
  rounds: typeof EMPTY_ROUNDS;
  questionId: number | null;
  answerList: AnswerList;
}) {
  return (
    <QuestionDetail
      questionId={questionId}
      rounds={rounds}
      answerList={answerList}
      fallbackQuestions={
        currentQuestion ? [currentQuestion, ...blockQuestions] : blockQuestions
      }
      highestClue={
        currentQuestion?.id === questionId
          ? currentQuestion.highestClue
          : undefined
      }
    />
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
  answerList,
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
  answerList: AnswerList;
  onGrade: AdminSession['gradeAnswer'];
  onAwardBonus: AdminSession['awardBonus'];
}) {
  const {
    progress,
    currentQuestion,
    activeBlockStartIndex,
    leaderboard,
    roundTitles,
    teams,
    ungradedQuestionIds,
    settings,
  } = view;
  return (
    <>
      <>
        <ClueStatus question={currentQuestion} />
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
              blockBoards={view.blockBoards}
            />
          </div>
          <div className="md:min-w-0 md:flex-1">
            <DetailPane
              view={view}
              rounds={rounds}
              item={item}
              questionId={questionId}
              isManualPick={isManualPick}
              answerList={answerList}
            />
          </div>
        </div>
        {answerList && (
          <AnswersPanel
            liveAnswers={answerList}
            teams={teams}
            onGrade={onGrade}
          />
        )}
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Teams</h2>
          <SideBar standings={view.sideStandings} />
          <TeamsTable
            joinCode={view.joinCode}
            leaderboard={leaderboard}
            roundTitles={roundTitles}
            onAwardBonus={onAwardBonus}
            enabledBonusCategories={settings.enabledBonusCategories}
            coinsByTeamId={
              teams.some((team) =>
                coinsShown(settings.powerUpsEnabled, team.coins),
              )
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
