'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExitIcon, GearIcon } from '@radix-ui/react-icons';
import {
  coinsShown,
  isShowingLastBreak,
  type PowerUpId,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { JoinTicket } from '@/app/components/join-form';
import { CopyButton } from '@/app/components/copy-button';
import { QuestionBrowser } from '@/app/play/question-browser';
import { FinalFeedbackForm } from '@/app/play/final-feedback-form';
import { RoundRatingCard } from '@/app/play/round-rating-card';
import { LatePlayerCountPrompt } from '@/app/play/late-player-count-prompt';
import { PlayerCountCard } from '@/app/play/player-count-card';
import { AnsweredQuestionsPanel } from '@/app/play/answered-questions-panel';
import { BonusProgressPanel } from '@/app/play/bonus-progress-panel';
import { PowerUpsPanel } from '@/app/play/power-ups-panel';
import { MobileQuizActionsBar } from '@/app/play/mobile-quiz-actions-bar';
import { PowerUpMoment, usePowerUpMoment } from '@/app/play/power-up-moment';
import { RevealVerdictCard } from '@/app/play/reveal-verdict-card';
import { SettingsModal } from '@/app/play/settings-modal';
import { LockMoment } from '@/app/play/lock-moment';
import { JokerMoment } from '@/app/play/joker-moment';
import { SideBadge, SidePicker } from '@/app/play/side-picker';
import {
  doubledRoundsOf,
  isJokerRoundPlayed,
  jokerMarksOf,
  selectedResultOf,
} from '@/app/play/joker-round';
import { ReconnectingBar } from '@/app/play/reconnecting-bar';
import {
  SavedConfirmation,
  useSavedConfirmation,
} from '@/app/play/saved-confirmation';
import { buildOpenedQuestions } from '@/app/play/opened-questions';
import { buildPickerRounds } from '@/app/play/question-picker-slots';
import { usePhoneQuestionBrowser } from '@/app/play/use-phone-question-browser';
import { useTeamLink } from '@/app/lib/use-team-link';
import { usePublishPlayerMenu } from '@/app/lib/player-menu-context';

function PlayPageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const { join, game } = useTeamLink(
    codeFromUrl,
    searchParams.get('teamCode') ?? '',
    searchParams.get('name') ?? '',
  );
  const { teamName, team, handleLogOut } = join;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Stable reference (like handleLogOut) so the publish effect below doesn't
  // re-fire on every unrelated re-render.
  const openSettings = useCallback(
    () => setIsSettingsOpen(true),
    [setIsSettingsOpen],
  );
  // Publishes the team's identity/Log out/Settings into the shared app
  // header so its mobile hamburger can surface them — see
  // player-menu-context.tsx.
  usePublishPlayerMenu(teamName, team, handleLogOut, openSettings);
  const { moment, showMoment } = usePowerUpMoment();
  const { isSaved, submitAndConfirm } = useSavedConfirmation(
    game?.submitAnswer,
  );
  const browser = usePhoneQuestionBrowser(game?.view ?? null);
  useCodeInUrl(teamName, game?.view.joinCode, codeFromUrl);

  if (join.needsJoinForm) {
    return (
      <JoinScreen
        join={join}
        hasStoredIdentity={join.hasStoredIdentity}
        onLogOut={handleLogOut}
      />
    );
  }

  if (!game) {
    return <ConnectingScreen teamName={teamName} onLogOut={handleLogOut} />;
  }

  return (
    <JoinedPlayScreen
      join={join}
      game={game}
      selectedQuestion={browser.selectedQuestion}
      jumpableQuestionIds={browser.jumpableQuestionIds}
      selectQuestion={browser.selectQuestion}
      revealQuestion={browser.revealQuestion}
      navigation={browser.navigation}
      autoAdvanceEnabled={browser.autoAdvanceEnabled}
      setAutoAdvance={browser.setAutoAdvance}
      isSaved={isSaved}
      onSubmitAnswer={submitAndConfirm}
      powerUpMoment={moment}
      showMoment={showMoment}
      settingsModal={{
        isOpen: isSettingsOpen,
        onOpenChange: setIsSettingsOpen,
      }}
      onOpenSettings={openSettings}
    />
  );
}

/**
 * Keeps ?code= in the address bar in sync with whichever session this
 * socket actually landed on — covers arriving here without a code (e.g.
 * the home page's post-join redirect, or a restored localStorage
 * identity) so the URL is always shareable/bookmarkable for this game,
 * never a stale or absent one. Gated on teamName: once a session closes
 * or a team is kicked, use-team-link.ts resets teamName to null but the
 * socket's own snapshot (disabled, not torn down) still holds the old
 * joinCode — without this guard, this effect would re-append that stale
 * code right after the redirect back to a bare /play clears it.
 */
function useCodeInUrl(
  teamName: string | null,
  joinCode: string | undefined,
  codeFromUrl: string,
) {
  const router = useRouter();
  useEffect(() => {
    if (teamName && joinCode && joinCode !== codeFromUrl) {
      router.replace(`/play?code=${joinCode}`);
    }
  }, [teamName, joinCode, codeFromUrl, router]);
}

/** The phone once its team is joined and the first view has arrived. */
function JoinedPlayScreen({
  join,
  game,
  selectedQuestion,
  jumpableQuestionIds,
  selectQuestion,
  revealQuestion,
  navigation,
  autoAdvanceEnabled,
  setAutoAdvance,
  isSaved,
  onSubmitAnswer,
  powerUpMoment,
  showMoment,
  settingsModal,
  onOpenSettings,
}: {
  join: TeamLink['join'];
  game: TeamGame;
  selectedQuestion: SelectedQuestion;
  jumpableQuestionIds: BrowserState['jumpableQuestionIds'];
  selectQuestion: BrowserState['selectQuestion'];
  revealQuestion: BrowserState['revealQuestion'];
  navigation: BrowserState['navigation'];
  autoAdvanceEnabled: boolean;
  setAutoAdvance: BrowserState['setAutoAdvance'];
  isSaved: boolean;
  onSubmitAnswer: SubmitAndConfirm;
  powerUpMoment: PowerUpMomentState['moment'];
  showMoment: PowerUpMomentState['showMoment'];
  settingsModal: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void };
  onOpenSettings: () => void;
}) {
  const { teamName, connectionError, isReconnecting, team } = join;
  const [playerCountSlot, setPlayerCountSlot] = useState<HTMLElement | null>(
    null,
  );
  const [isPickingSide, setIsPickingSide] = useState(false);
  const { view, myAnswers, myJoker, myPurchases } = game;
  const { progress, settings, quizStructure } = view;
  // The block browser (question picker + prompt) is the `block` phone
  // screen: open questions, and break/reveal so teams can review the block
  // they just answered. It needs a question to show.
  const openedQuestions = buildOpenedQuestions(game.seenQuestions, myAnswers);
  const bonus =
    settings.enabledBonusCategories.length > 0
      ? {
          enabledCategories: settings.enabledBonusCategories,
          maxAwardsPerCategory: settings.maxBonusAwardsPerCategory,
          myBonusAwards: game.myBonusAwards,
          quizStructure,
          showAvailability: !isShowingLastBreak(progress, quizStructure),
        }
      : null;
  const powerUpsList = powerUpsListOf({
    view,
    team,
    selectedQuestion,
    myPurchases,
    roomReadyQuestionIds: game.roomReadyQuestionIds,
    jokerRoundId: myJoker?.roundId ?? null,
    buyPowerUp: game.buyPowerUp,
    buyExtraJoker: game.buyExtraJoker,
    showMoment,
  });
  const jokerMarks = jokerMarksOf(
    view,
    myJoker,
    myPurchases,
    selectedQuestion?.id,
  );
  const isConnected = connectionError === null;
  const { mySideId } = game;

  // A side-less team picks before anything else; in the lobby a team may reopen the picker to switch.
  if (isSidePickerShown(settings, mySideId, isPickingSide)) {
    return (
      <SidePicker
        sides={settings.versusSides}
        mySideId={mySideId}
        onPick={game.pickSide}
        onClose={() => setIsPickingSide(false)}
      />
    );
  }

  return (
    <main
      className={`flex min-h-screen flex-col bg-background px-5 text-foreground ${
        // The fixed bar sits over the top edge, so leave room for it.
        isReconnecting ? 'pt-14' : 'pt-1'
      } pb-24 md:pb-5`}
    >
      {/* Order below is mobile-first (team identity sits last, under the
          block browser) and reshuffled back to the original top-down
          layout at md: identity header first, then error/status, then the
          browser+panels row. */}
      <TeamHeader
        teamName={teamName}
        team={team}
        doubledRounds={jokerMarks.doubledRounds}
        status={progress.status}
        pastRevealedQuestions={view.pastRevealedQuestions}
        side={headerSideOf(settings, mySideId, progress.status, () =>
          setIsPickingSide(true),
        )}
        onOpenSettings={onOpenSettings}
        onLogOut={join.handleLogOut}
      />
      <ConnectionNotices
        connectionError={connectionError}
        isReconnecting={isReconnecting}
        onReconnect={join.forceReconnect}
      />
      <StatusSection
        game={game}
        team={team}
        teamName={teamName}
        isConnected={isConnected}
        isJokerTitleCard={jokerMarks.isJokerTitleCard}
        playerCountSlot={playerCountSlot}
      />
      <div className="order-3 md:order-4 flex flex-col items-center gap-6 lg:flex-row lg:items-start">
        <BlockBrowser
          game={game}
          team={team}
          selectedQuestion={selectedQuestion}
          revealQuestion={revealQuestion}
          navigation={navigation}
          onSelectQuestion={selectQuestion}
          openedQuestions={openedQuestions}
          jokerMarks={jokerMarks}
          onSubmitAnswer={onSubmitAnswer}
        />
        <div className="flex flex-col gap-6 md:flex-row">
          <AnsweredQuestionsPanel
            entries={openedQuestions}
            jumpableIds={jumpableQuestionIds}
            onSelectQuestion={selectQuestion}
          />
          {powerUpsList && <PowerUpsPanel {...powerUpsList} />}
          {bonus && <BonusProgressPanel {...bonus} />}
        </div>
      </div>
      <div
        ref={setPlayerCountSlot}
        className="order-5 mt-auto pt-4 empty:hidden"
      />
      {/* MobileQuizActionsBar is fixed to the viewport bottom on mobile, so the
          page needs matching bottom padding there (pb-24 above) or the bar
          would cover the last bit of inline content underneath it. */}
      <MobileQuizActionsBar
        historyEntries={openedQuestions}
        jumpableHistoryIds={jumpableQuestionIds}
        onSelectHistoryQuestion={selectQuestion}
        powerUps={powerUpsList}
        bonus={bonus}
      />
      <RevealVerdictCard
        view={view}
        myAnswers={myAnswers}
        isConnected={isConnected}
        doubledRoundNumbers={jokerMarks.doubledRoundNumbers}
      />
      <SavedConfirmation isVisible={isSaved} />
      <PowerUpMoment moment={powerUpMoment} />
      <SettingsModal
        isOpen={settingsModal.isOpen}
        onOpenChange={settingsModal.onOpenChange}
        autoAdvanceEnabled={autoAdvanceEnabled}
        onAutoAdvanceChange={setAutoAdvance}
        playerCount={game.myPlayerCount}
        onPlayerCountChange={game.setPlayerCount}
      />
    </main>
  );
}

/** Whether the side picker covers the phone: Versus is on and the team has no side yet, or it reopened the picker to switch. */
function isSidePickerShown(
  settings: PlayerView['settings'],
  mySideId: string | null,
  isReopened: boolean,
): boolean {
  return settings.versusEnabled && (mySideId === null || isReopened);
}

/** The side badge the header shows (null without Versus or a side); switching is offered in the lobby only. */
function headerSideOf(
  settings: PlayerView['settings'],
  mySideId: string | null,
  status: PlayerView['progress']['status'],
  onSwitch: () => void,
) {
  if (!settings.versusEnabled || mySideId === null) return null;
  return {
    sides: settings.versusSides,
    sideId: mySideId,
    onSwitch: status === 'lobby' ? onSwitch : undefined,
  };
}

function ConnectionNotices({
  connectionError,
  isReconnecting,
  onReconnect,
}: {
  connectionError: TeamLink['join']['connectionError'];
  isReconnecting: boolean;
  onReconnect: () => void;
}) {
  if (isReconnecting) return <ReconnectingBar onReconnect={onReconnect} />;
  if (!connectionError) return null;
  return (
    <p
      role="alert"
      className="order-1 mb-4 font-extrabold text-magenta md:order-2"
    >
      {connectionError}
    </p>
  );
}

/** The block browser, on the `block` phone screen once there is a question to show. */
function BlockBrowser({
  game,
  team,
  selectedQuestion,
  revealQuestion,
  navigation,
  onSelectQuestion,
  openedQuestions,
  jokerMarks,
  onSubmitAnswer,
}: {
  game: Pick<TeamGame, 'view' | 'myAnswers' | 'myPurchases'>;
  team: JoinedTeam;
  selectedQuestion: SelectedQuestion;
  revealQuestion: BrowserState['revealQuestion'];
  navigation: BrowserState['navigation'];
  onSelectQuestion: BrowserState['selectQuestion'];
  openedQuestions: ReturnType<typeof buildOpenedQuestions>;
  jokerMarks: ReturnType<typeof jokerMarksOf>;
  onSubmitAnswer: SubmitAndConfirm;
}) {
  const { view, myAnswers, myPurchases } = game;
  const { phoneScreen, blockQuestions, upcomingQuestions } = view;
  if (phoneScreen.kind !== 'block' || !selectedQuestion) return null;
  const selectedResult = selectedResultOf(
    openedQuestions,
    selectedQuestion.id,
    jokerMarks.doubledRoundNumbers,
  );
  return (
    <div className="md:min-w-0 md:flex-1">
      <QuestionBrowser
        mode={phoneScreen.mode}
        isAnswerable={view.isAnswerable}
        team={team}
        pickerRounds={buildPickerRounds(blockQuestions, upcomingQuestions)}
        totalPickerSlots={blockQuestions.length + upcomingQuestions.length}
        selectedQuestion={selectedQuestion}
        revealQuestion={revealQuestion}
        isQuickfireMode={view.isCurrentRoundQuickfire}
        myAnswers={myAnswers}
        myAnswerPoints={selectedResult.points}
        myAnswerVerdict={selectedResult.verdict}
        myAnswerJokerExtra={selectedResult.jokerExtra}
        onSelectQuestion={onSelectQuestion}
        onSubmitAnswer={onSubmitAnswer}
        navigation={navigation}
        isJokerQuestion={jokerMarks.isJokerQuestion}
        doubledRoundNumbers={jokerMarks.doubledRoundNumbers}
        purchases={myPurchases}
      />
    </div>
  );
}

export default function PlayPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <PlayPageContent />
    </Suspense>
  );
}

type TeamLink = ReturnType<typeof useTeamLink>;
type TeamGame = NonNullable<TeamLink['game']>;
type PlayerView = TeamGame['view'];
type JoinedTeam = TeamLink['join']['team'];
type StatusGame = Pick<
  TeamGame,
  | 'view'
  | 'myPlayerCount'
  | 'setPlayerCount'
  | 'myJoker'
  | 'mySideId'
  | 'pickJoker'
  | 'submitShowdownGuess'
  | 'roundRatingsEpoch'
  | 'myRoundRatings'
  | 'rateRound'
  | 'mySessionRatings'
  | 'rateSession'
  | 'myFeedback'
  | 'sendFeedback'
>;
type BrowserState = ReturnType<typeof usePhoneQuestionBrowser>;
type SelectedQuestion = BrowserState['selectedQuestion'];
type PowerUpMomentState = ReturnType<typeof usePowerUpMoment>;
type SubmitAndConfirm = ReturnType<
  typeof useSavedConfirmation
>['submitAndConfirm'];

function JoinScreen({
  join,
  hasStoredIdentity,
  onLogOut,
}: {
  join: TeamLink['join'];
  hasStoredIdentity: boolean;
  onLogOut: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 py-10 text-foreground">
      <JoinTicket join={join} headingTag="h1" />
      {hasStoredIdentity && (
        <Button
          type="button"
          variant="text-quiet"
          onClick={onLogOut}
          className="flex"
        >
          <ExitIcon aria-hidden="true" />
          Log out
        </Button>
      )}
    </main>
  );
}

function ConnectingScreen({
  teamName,
  onLogOut,
}: {
  teamName: TeamLink['join']['teamName'];
  onLogOut: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
      <p className="text-sm font-extrabold tracking-wide text-foreground/55">
        Playing as {teamName}
      </p>
      <p className="font-display text-xl">Connecting…</p>
      <Button
        type="button"
        variant="text-quiet"
        onClick={onLogOut}
        className="flex"
      >
        <ExitIcon aria-hidden="true" />
        Log out
      </Button>
    </main>
  );
}

/** The power-ups card's props, or null when the team doesn't see the shop (same condition as the coins: a carried coin shows it even without power-ups). */
function powerUpsListOf({
  view,
  team,
  selectedQuestion,
  myPurchases,
  roomReadyQuestionIds,
  jokerRoundId,
  buyPowerUp,
  buyExtraJoker,
  showMoment,
}: {
  view: PlayerView;
  team: JoinedTeam;
  selectedQuestion: SelectedQuestion;
  myPurchases: TeamGame['myPurchases'];
  roomReadyQuestionIds: TeamGame['roomReadyQuestionIds'];
  jokerRoundId: number | null;
  buyPowerUp: TeamGame['buyPowerUp'];
  buyExtraJoker: TeamGame['buyExtraJoker'];
  showMoment: PowerUpMomentState['showMoment'];
}) {
  const { phoneScreen, settings } = view;
  if (!team || !coinsShown(settings.powerUpsEnabled, team.coins)) return null;
  // The activation buttons live in the power-ups cards: the question being answered right now, and the next round's extra joker.
  const answeringQuestion =
    phoneScreen.kind === 'block' &&
    phoneScreen.mode === 'answering' &&
    view.isAnswerable
      ? selectedQuestion
      : null;
  return {
    settings: settings.powerUps,
    purchases: myPurchases,
    coins: team.coins,
    question: answeringQuestion,
    roomReadyQuestionIds,
    onBuy: async (powerUp: PowerUpId, questionId: number) => {
      const result = await buyPowerUp(powerUp, questionId);
      if (result.success) {
        showMoment(powerUp, settings.powerUps[powerUp].cost);
      }
      return result;
    },
    extraJokerOffer: view.extraJokerOffer,
    jokerRoundId,
    clueRounds: view.clueRounds,
    onBuyExtraJoker: async (roundId: number) => {
      const result = await buyExtraJoker(roundId);
      if (result.success) {
        showMoment('extra_joker', settings.powerUps.extra_joker.cost);
      }
      return result;
    },
  };
}

function TeamHeader({
  teamName,
  team,
  doubledRounds,
  status,
  pastRevealedQuestions,
  side,
  onOpenSettings,
  onLogOut,
}: {
  teamName: TeamLink['join']['teamName'];
  team: JoinedTeam;
  doubledRounds: ReturnType<typeof doubledRoundsOf>;
  status: PlayerView['progress']['status'];
  pastRevealedQuestions: PlayerView['pastRevealedQuestions'];
  side: {
    sides: PlayerView['settings']['versusSides'];
    sideId: string;
    onSwitch: (() => void) | undefined;
  } | null;
  onOpenSettings: () => void;
  onLogOut: () => void;
}) {
  return (
    <div className="order-4 md:order-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55 mb-2">
          Playing as {teamName}
          {side && (
            <>
              {' '}
              {side.onSwitch ? (
                <button
                  type="button"
                  aria-label="Switch side"
                  onClick={side.onSwitch}
                >
                  <SideBadge sides={side.sides} sideId={side.sideId} />
                </button>
              ) : (
                <SideBadge sides={side.sides} sideId={side.sideId} />
              )}
            </>
          )}
        </p>
        <div className="hidden items-center gap-2 md:flex">
          <Button
            type="button"
            variant="text-quiet"
            onClick={onOpenSettings}
            className="flex"
          >
            <GearIcon aria-hidden="true" />
            Settings
          </Button>
          <Button
            type="button"
            variant="text-quiet"
            onClick={onLogOut}
            className="flex"
          >
            <ExitIcon aria-hidden="true" />
            Change team
          </Button>
        </div>
      </div>
      {doubledRounds.map(({ roundNumber, title }) => {
        const isPlayed = isJokerRoundPlayed(
          roundNumber,
          status,
          pastRevealedQuestions,
        );
        return (
          <p
            key={roundNumber}
            className={`mb-2 w-fit rounded-lg px-3 py-1.5 text-sm font-extrabold ${
              isPlayed ? 'bg-foreground/5 text-foreground/70' : 'bg-yellow/25'
            }`}
          >
            <span aria-hidden="true">🃏 </span>
            {`Round ${roundNumber}${title === '' ? '' : ` — ${title}`} ${
              isPlayed ? 'scored' : 'scores'
            } double`}
          </p>
        );
      })}
      {team && (
        <p className="mb-4 hidden flex-wrap items-center gap-1 text-xs text-foreground/45 md:flex">
          Team code: {team.teamCode}
          <CopyButton value={team.teamCode} /> — save it to play as this team
          another night.
        </p>
      )}
    </div>
  );
}

/** The middle of the phone: the moments, the feedback cards and the status screen for where the quiz is. */
function StatusSection({
  game,
  team,
  teamName,
  isConnected,
  isJokerTitleCard,
  playerCountSlot,
}: {
  game: StatusGame;
  team: JoinedTeam;
  teamName: TeamLink['join']['teamName'];
  isConnected: boolean;
  isJokerTitleCard: boolean;
  playerCountSlot: HTMLElement | null;
}) {
  const {
    view,
    myPlayerCount,
    setPlayerCount,
    myJoker,
    pickJoker,
    submitShowdownGuess,
  } = game;
  const {
    progress,
    phoneScreen,
    quizStructure,
    settings,
    activeShowdown,
    showdownRevealStep,
    phoneLeaderboard,
  } = view;
  const myTeamId = team?.teamId ?? null;
  return (
    <div className="order-2 md:order-3">
      <LockMoment
        status={progress.status}
        lockAt={view.questionLockAt}
        isConnected={isConnected}
      />
      <JokerMoment
        progress={progress}
        isJokerIntro={isJokerTitleCard && progress.status === 'round_intro'}
        isConnected={isConnected}
      />
      <BreakRatingCard game={game} />
      <LatePlayerCountPrompt
        joinCode={view.joinCode}
        hasJoined={team !== null}
        isLobby={phoneScreen.kind === 'lobby'}
        savedCount={myPlayerCount}
        onSend={setPlayerCount}
        bottomSlot={playerCountSlot}
      />
      <GameStatusScreens
        phoneScreen={phoneScreen}
        quizStructure={quizStructure}
        joinCode={view.joinCode}
        settings={settings}
        activeShowdown={activeShowdown}
        showdownRevealStep={showdownRevealStep}
        myTeamId={myTeamId}
        mySideId={game.mySideId}
        // A team's coins in a session with power-ups, or a carried coin in one without.
        coins={
          coinsShown(settings.powerUpsEnabled, team?.coins ?? 0)
            ? team?.coins
            : undefined
        }
        hasCarriedCoin={team?.hasCarriedCoin}
        phoneLeaderboard={phoneLeaderboard}
        isConnected={isConnected}
        teamName={teamName}
        leaderboard={view.leaderboard}
        playerCountCard={
          <PlayerCountCard
            savedCount={myPlayerCount}
            onSend={setPlayerCount}
            bottomSlot={playerCountSlot}
          />
        }
        jokerPick={view.jokerPick}
        myJoker={myJoker}
        onPickJoker={pickJoker}
        isJokerBadgeShown={
          isJokerTitleCard && progress.status !== 'round_intro'
        }
        onSubmitShowdownGuess={submitShowdownGuess}
      />
      <FinalFeedback game={game} />
    </div>
  );
}

function BreakRatingCard({
  game,
}: {
  game: Pick<
    TeamGame,
    'view' | 'roundRatingsEpoch' | 'myRoundRatings' | 'rateRound'
  >;
}) {
  const { feedback } = game.view;
  if (feedback?.kind !== 'break_card') return null;
  return (
    // A join payload replaces the saved ratings, so a reconnect starts
    // the card afresh: a tap still waiting on the old connection's ack
    // is dropped rather than shown as saved.
    <RoundRatingCard
      key={game.roundRatingsEpoch}
      rounds={feedback.rounds}
      savedRatings={game.myRoundRatings}
      onRate={game.rateRound}
    />
  );
}

function FinalFeedback({
  game,
}: {
  game: Pick<
    TeamGame,
    | 'view'
    | 'myRoundRatings'
    | 'roundRatingsEpoch'
    | 'rateRound'
    | 'mySessionRatings'
    | 'rateSession'
    | 'myFeedback'
    | 'sendFeedback'
  >;
}) {
  const { feedback } = game.view;
  if (feedback?.kind !== 'final_form') return null;
  return (
    <FinalFeedbackForm
      rounds={feedback.rounds}
      savedRatings={game.myRoundRatings}
      ratingsEpoch={game.roundRatingsEpoch}
      onRate={game.rateRound}
      savedSessionRatings={game.mySessionRatings}
      onRateSession={game.rateSession}
      savedFeedback={game.myFeedback}
      onSendFeedback={game.sendFeedback}
    />
  );
}
