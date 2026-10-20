'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExitIcon, GearIcon } from '@radix-ui/react-icons';
import { isShowingLastBreak } from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { JoinForm } from '@/app/components/join-form';
import { CopyButton } from '@/app/components/copy-button';
import { QuestionBrowser } from '@/app/play/question-browser';
import { FinalFeedbackForm } from '@/app/play/final-feedback-form';
import { RoundRatingCard } from '@/app/play/round-rating-card';
import { LatePlayerCountPrompt } from '@/app/play/late-player-count-prompt';
import { PlayerCountCard } from '@/app/play/player-count-card';
import { AnsweredQuestionsPanel } from '@/app/play/answered-questions-panel';
import { BonusProgressPanel } from '@/app/play/bonus-progress-panel';
import { MobileQuizActionsBar } from '@/app/play/mobile-quiz-actions-bar';
import { RevealVerdictCard } from '@/app/play/reveal-verdict-card';
import { SettingsModal } from '@/app/play/settings-modal';
import { LockMoment } from '@/app/play/lock-moment';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const teamCodeFromUrl = searchParams.get('teamCode') ?? '';
  const nameFromUrl = searchParams.get('name') ?? '';
  const { join, game } = useTeamLink(codeFromUrl, teamCodeFromUrl, nameFromUrl);
  const {
    teamName,
    nameInput,
    setNameInput,
    codeInput,
    setCodeInput,
    teamCodeInput,
    setTeamCodeInput,
    hasStoredIdentity,
    connectionError,
    isReconnecting,
    forceReconnect,
    team,
    needsJoinForm,
    handleJoin,
    handleLogOut,
  } = join;
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
  const { isSaved, submitAndConfirm } = useSavedConfirmation(
    game?.submitAnswer,
  );
  const {
    selectedQuestion,
    revealQuestion,
    navigation,
    jumpableQuestionIds,
    selectQuestion,
    autoAdvanceEnabled,
    setAutoAdvance,
  } = usePhoneQuestionBrowser(game?.view ?? null);

  const joinCode = game?.view.joinCode;
  useEffect(() => {
    // Keeps ?code= in the address bar in sync with whichever session this
    // socket actually landed on — covers arriving here without a code (e.g.
    // the home page's post-join redirect, or a restored localStorage
    // identity) so the URL is always shareable/bookmarkable for this game,
    // never a stale or absent one. Gated on teamName: once a session closes
    // or a team is kicked, use-team-link.ts resets teamName to null but the
    // socket's own snapshot (disabled, not torn down) still holds the old
    // joinCode — without this guard, this effect would re-append that stale
    // code right after the redirect back to a bare /play clears it.
    if (teamName && joinCode && joinCode !== codeFromUrl) {
      router.replace(`/play?code=${joinCode}`);
    }
  }, [teamName, joinCode, codeFromUrl, router]);

  if (needsJoinForm) {
    return (
      <main className="flex min-h-screen flex-col justify-center gap-4 bg-background px-7 py-10 text-foreground">
        <h1 className="text-center font-display text-3xl text-magenta">
          🍺 Join the quiz
        </h1>
        <p className="-mt-2 text-center text-sm text-foreground/65">
          Grab a table, pick a name
        </p>
        <JoinForm
          nameInput={nameInput}
          onNameInputChange={setNameInput}
          codeInput={codeInput}
          onCodeInputChange={setCodeInput}
          teamCodeInput={teamCodeInput}
          onTeamCodeInputChange={setTeamCodeInput}
          connectionError={connectionError}
          onSubmit={handleJoin}
          alwaysShowTeamCode
          hideGameCodeInput
        />
        {hasStoredIdentity && (
          <Button
            type="button"
            variant="text-quiet"
            onClick={handleLogOut}
            className="mx-auto flex"
          >
            <ExitIcon aria-hidden="true" />
            Log out
          </Button>
        )}
      </main>
    );
  }

  if (!game) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">
          Playing as {teamName}
        </p>
        <p className="font-display text-xl">Connecting…</p>
        <Button
          type="button"
          variant="text-quiet"
          onClick={handleLogOut}
          className="flex"
        >
          <ExitIcon aria-hidden="true" />
          Log out
        </Button>
      </main>
    );
  }

  const {
    view,
    myAnswers,
    myAnswerGrades,
    myBonusAwards,
    myRoundRatings,
    roundRatingsEpoch,
    rateRound,
    myFeedback,
    sendFeedback,
    myPlayerCount,
    setPlayerCount,
    seenQuestions,
    submitShowdownGuess,
  } = game;
  const {
    progress,
    blockQuestions,
    upcomingQuestions,
    quizStructure,
    isCurrentRoundKahoot,
    settings,
    activeShowdown,
    showdownRevealStep,
    isAnswerable,
    phoneScreen,
    phoneLeaderboard,
    feedback,
  } = view;
  const myTeamId = team?.teamId ?? null;
  const pickerRounds = buildPickerRounds(blockQuestions, upcomingQuestions);
  const totalPickerSlots = blockQuestions.length + upcomingQuestions.length;
  // The block browser (question picker + prompt) is the `block` phone
  // screen: open questions, and break/reveal so teams can review the block
  // they just answered. It needs a question to show.
  const openedQuestions = buildOpenedQuestions(
    seenQuestions,
    myAnswers,
    myAnswerGrades,
  );
  const selectedEntry = selectedQuestion
    ? openedQuestions.find((entry) => entry.id === selectedQuestion.id)
    : undefined;
  const selectedQuestionPoints = selectedEntry?.pointsAwarded ?? null;
  const selectedQuestionVerdict = selectedEntry?.verdict ?? null;
  // MobileQuizActionsBar is fixed to the viewport bottom on mobile, so the
  // page needs matching bottom padding there or the bar would cover the
  // last bit of inline content underneath it.
  const hasBonusPanel = settings.enabledBonusCategories.length > 0;
  const showBonusAvailability = !isShowingLastBreak(progress, quizStructure);
  const hasMobileActionBar = hasBonusPanel || openedQuestions.length > 0;

  return (
    <main
      className={`flex min-h-screen flex-col bg-background px-5 text-foreground ${
        // The fixed bar sits over the top edge, so leave room for it.
        isReconnecting ? 'pt-14' : 'pt-1'
      } ${hasMobileActionBar ? 'pb-24 md:pb-5' : 'pb-5'}`}
    >
      {/* Order below is mobile-first (team identity sits last, under the
          block browser) and reshuffled back to the original top-down
          layout at md: identity header first, then error/status, then the
          browser+panels row. */}
      <div className="order-4 md:order-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold tracking-wide text-foreground/55 mb-2">
            Playing as {teamName}
          </p>
          <div className="hidden items-center gap-2 md:flex">
            <Button
              type="button"
              variant="text-quiet"
              onClick={openSettings}
              className="flex"
            >
              <GearIcon aria-hidden="true" />
              Settings
            </Button>
            <Button
              type="button"
              variant="text-quiet"
              onClick={handleLogOut}
              className="flex"
            >
              <ExitIcon aria-hidden="true" />
              Change team
            </Button>
          </div>
        </div>
        {team && (
          <p className="mb-4 hidden flex-wrap items-center gap-1 text-xs text-foreground/45 md:flex">
            Team code: {team.teamCode}
            <CopyButton value={team.teamCode} /> — save it to play as this team
            another night.
          </p>
        )}
      </div>
      {isReconnecting && <ReconnectingBar onReconnect={forceReconnect} />}
      {connectionError && !isReconnecting && (
        <p
          role="alert"
          className="order-1 mb-4 font-extrabold text-magenta md:order-2"
        >
          {connectionError}
        </p>
      )}
      <div className="order-2 md:order-3">
        <LockMoment
          status={progress.status}
          lockAt={view.questionLockAt}
          isConnected={connectionError === null}
        />
        {feedback?.kind === 'break_card' && (
          // A join payload replaces the saved ratings, so a reconnect starts
          // the card afresh: a tap still waiting on the old connection's ack
          // is dropped rather than shown as saved.
          <RoundRatingCard
            key={roundRatingsEpoch}
            rounds={feedback.rounds}
            savedRatings={myRoundRatings}
            onRate={rateRound}
          />
        )}
        <LatePlayerCountPrompt
          joinCode={view.joinCode}
          hasJoined={team !== null}
          isLobby={phoneScreen.kind === 'lobby'}
          savedCount={myPlayerCount}
          onSend={setPlayerCount}
        />
        <GameStatusScreens
          phoneScreen={phoneScreen}
          quizStructure={quizStructure}
          joinCode={view.joinCode}
          settings={settings}
          activeShowdown={activeShowdown}
          showdownRevealStep={showdownRevealStep}
          myTeamId={myTeamId}
          phoneLeaderboard={phoneLeaderboard}
          isConnected={connectionError === null}
          teamName={teamName}
          leaderboard={view.leaderboard}
          playerCountCard={
            <PlayerCountCard
              savedCount={myPlayerCount}
              onSend={setPlayerCount}
            />
          }
          onSubmitShowdownGuess={submitShowdownGuess}
        />
        {feedback?.kind === 'final_form' && (
          <FinalFeedbackForm
            rounds={feedback.rounds}
            savedRatings={myRoundRatings}
            ratingsEpoch={roundRatingsEpoch}
            onRate={rateRound}
            savedFeedback={myFeedback}
            onSendFeedback={sendFeedback}
          />
        )}
      </div>
      <div className="order-3 md:order-4 flex flex-col items-center gap-6 lg:flex-row lg:items-start">
        {selectedQuestion && (
          <div className="md:min-w-0 md:flex-1">
            <QuestionBrowser
              progress={progress}
              isAnswerable={isAnswerable}
              team={team}
              pickerRounds={pickerRounds}
              totalPickerSlots={totalPickerSlots}
              selectedQuestion={selectedQuestion}
              revealQuestion={revealQuestion}
              isKahootMode={isCurrentRoundKahoot}
              myAnswers={myAnswers}
              myAnswerPoints={selectedQuestionPoints}
              myAnswerVerdict={selectedQuestionVerdict}
              onSelectQuestion={selectQuestion}
              onSubmitAnswer={submitAndConfirm}
              navigation={navigation}
            />
          </div>
        )}
        <div className="flex flex-col gap-6 md:flex-row">
          {openedQuestions.length > 0 && (
            <AnsweredQuestionsPanel
              entries={openedQuestions}
              jumpableIds={jumpableQuestionIds}
              onSelectQuestion={selectQuestion}
            />
          )}
          {hasBonusPanel && (
            <BonusProgressPanel
              enabledCategories={settings.enabledBonusCategories}
              maxAwardsPerCategory={settings.maxBonusAwardsPerCategory}
              myBonusAwards={myBonusAwards}
              quizStructure={quizStructure}
              showAvailability={showBonusAvailability}
            />
          )}
        </div>
      </div>
      <MobileQuizActionsBar
        historyEntries={openedQuestions}
        jumpableHistoryIds={jumpableQuestionIds}
        onSelectHistoryQuestion={selectQuestion}
        bonus={
          hasBonusPanel
            ? {
                enabledCategories: settings.enabledBonusCategories,
                maxAwardsPerCategory: settings.maxBonusAwardsPerCategory,
                myBonusAwards,
                quizStructure,
                showAvailability: showBonusAvailability,
              }
            : null
        }
      />
      <RevealVerdictCard
        view={view}
        myAnswers={myAnswers}
        myAnswerGrades={myAnswerGrades}
        isConnected={connectionError === null}
      />
      <SavedConfirmation isVisible={isSaved} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        autoAdvanceEnabled={autoAdvanceEnabled}
        onAutoAdvanceChange={setAutoAdvance}
        playerCount={myPlayerCount}
        onPlayerCountChange={setPlayerCount}
      />
    </main>
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
