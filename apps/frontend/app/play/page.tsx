'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExitIcon } from '@radix-ui/react-icons';
import {
  DEFAULT_SESSION_SETTINGS,
  type GameStatus,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { JoinForm } from '@/app/components/join-form';
import { CopyButton } from '@/app/components/copy-button';
import { QuestionBrowser } from '@/app/play/question-browser';
import { AnsweredQuestionsPanel } from '@/app/play/answered-questions-panel';
import { BonusProgressPanel } from '@/app/play/bonus-progress-panel';
import { buildOpenedQuestions } from '@/app/play/opened-questions';
import { buildPickerRounds } from '@/app/play/question-picker-slots';
import { useTeamJoin } from '@/app/lib/use-team-join';
import { storedJoinOptions } from '@/app/lib/team-storage';
import { usePublishPlayerMenu } from '@/app/lib/player-menu-context';

function PlayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
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
    snapshot,
    team,
    joinTeam,
    submitAnswer,
    myAnswers = {},
    myAnswerGrades = {},
    myBonusAwards = [],
    seenQuestions = {},
    handleJoin,
    handleLogOut,
  } = useTeamJoin(codeFromUrl);
  // Publishes the team's identity/Log out into the shared app header so its
  // mobile hamburger can surface them — see player-menu-context.tsx.
  usePublishPlayerMenu(teamName, team, handleLogOut);
  // null = follow the question currently shown on the big screen.
  const [browsedQuestionId, setBrowsedQuestionId] = useState<number | null>(
    null,
  );
  const gameStatus = snapshot?.progress.status;
  const currentQuestionId = snapshot?.currentQuestion?.id ?? null;
  const revealIndex = snapshot?.progress.revealIndex ?? null;
  // Only changes while actively revealing (currentQuestionId stays null
  // throughout break/reveal), so this alone can key the reveal-walk sync.
  const revealSyncKey = gameStatus === 'reveal' ? revealIndex : null;

  // Snap back to the newest question whenever the quiz master reveals a new
  // question, or steps through the reveal walk. Adjusted during render
  // rather than in an Effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevQuestionId, setPrevQuestionId] = useState(currentQuestionId);
  const [prevRevealSyncKey, setPrevRevealSyncKey] = useState(revealSyncKey);
  if (
    currentQuestionId !== prevQuestionId ||
    revealSyncKey !== prevRevealSyncKey
  ) {
    setPrevQuestionId(currentQuestionId);
    setPrevRevealSyncKey(revealSyncKey);
    setBrowsedQuestionId(null);
  }

  const previousGameStatusRef = useRef<GameStatus | undefined>(undefined);
  useEffect(() => {
    const previousGameStatus = previousGameStatusRef.current;
    previousGameStatusRef.current = gameStatus;
    // A transition *into* lobby from some other status means the admin
    // restarted the game session, which invalidates the team registration —
    // re-joining re-registers the team under the new session. Skip the very
    // first status this effect sees (whether from a fresh connect or a
    // page refresh that happens to land back in lobby): use-team-join.ts's
    // own reconnect join already covers that case, and firing a second join
    // here too would race it against the old socket's still-pending
    // disconnect cleanup and can wrongly bounce a refresh with "already
    // connected".
    if (
      gameStatus !== 'lobby' ||
      !teamName ||
      previousGameStatus === undefined ||
      previousGameStatus === 'lobby'
    ) {
      return;
    }
    joinTeam(teamName, storedJoinOptions());
  }, [gameStatus, teamName, joinTeam]);

  useEffect(() => {
    // Keeps ?code= in the address bar in sync with whichever session this
    // socket actually landed on — covers arriving here without a code (e.g.
    // the home page's post-join redirect, or a restored localStorage
    // identity) so the URL is always shareable/bookmarkable for this game,
    // never a stale or absent one.
    if (snapshot?.joinCode && snapshot.joinCode !== codeFromUrl) {
      router.replace(`/play?code=${snapshot.joinCode}`);
    }
  }, [snapshot, codeFromUrl, router]);

  if (!teamName || (connectionError && !team)) {
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

  if (!snapshot) {
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
    progress,
    currentQuestion,
    blockQuestions = [],
    upcomingQuestions = [],
    revealQuestions = [],
    quizStructure = {
      blockCount: 0,
      topicsPerBlock: null,
      breakRoundNumbers: [],
      minQuestionsPerTopic: 0,
      maxQuestionsPerTopic: 0,
    },
    roundTitle = '',
    closestGuessRevealStep = 0,
    settings = DEFAULT_SESSION_SETTINGS,
  } = snapshot;
  const pickerRounds = buildPickerRounds(blockQuestions, upcomingQuestions);
  const totalPickerSlots = blockQuestions.length + upcomingQuestions.length;
  // During reveal, the big screen walks one question at a time via
  // revealIndex — teams should see the same one, not stay pinned to the
  // block's last question the way question_open/break does.
  const revealDisplayQuestion =
    progress.status === 'reveal'
      ? blockQuestions[progress.revealIndex]
      : undefined;
  // Defaults to the block's last (furthest-ever-opened) question rather than
  // currentQuestion, which tracks the display's literal position - stepping
  // the display backward with PREVIOUS must not drag /play's default view
  // back with it, since teams should keep answering the newest question.
  const selectedQuestion =
    blockQuestions.find((question) => question.id === browsedQuestionId) ??
    revealDisplayQuestion ??
    blockQuestions[blockQuestions.length - 1] ??
    currentQuestion ??
    null;
  // The same question with its correct answer attached, for showing "your
  // answer" alongside it while reveal is up.
  const revealQuestion =
    progress.status === 'reveal' && selectedQuestion
      ? revealQuestions.find((question) => question.id === selectedQuestion.id)
      : undefined;
  // Answering stays available even while the leaderboard is toggled on for
  // the big screen — only a real lock (status leaving question_open/locking)
  // should stop teams from answering. round_intro also stays answerable when
  // Previous steps the display back into a round whose questions are already
  // open (blockQuestions non-empty) — only a genuinely fresh round_intro
  // (nothing opened yet) blocks answering.
  const isAnswerable =
    progress.status === 'question_open' ||
    progress.status === 'locking' ||
    (progress.status === 'round_intro' && blockQuestions.length > 0);
  const isBreakOrReveal =
    progress.status === 'break_intro' ||
    progress.status === 'break' ||
    progress.status === 'break_round_intro' ||
    progress.status === 'reveal_intro' ||
    progress.status === 'reveal';
  // Same "look at the screen" round title card as round_intro, shown when
  // reveal crosses into a new round within the block, or PREVIOUS steps back
  // through break to a round's own title — sourced from the block/reveal
  // question at revealIndex, since progress.roundIndex stays pinned to the
  // block's last round throughout break/reveal (see display/page.tsx).
  const revealIntroRoundTitle =
    progress.status === 'reveal_intro'
      ? revealQuestions[progress.revealIndex]?.roundTitle
      : undefined;
  const breakRoundIntroRoundTitle =
    progress.status === 'break_round_intro'
      ? blockQuestions[progress.revealIndex]?.roundTitle
      : undefined;
  // The block browser (question picker + prompt) stays up through break/reveal
  // too, so teams can review the block they just answered — unless the
  // leaderboard overlay is toggled on, which takes over the screen instead.
  const showBlockBrowser =
    Boolean(selectedQuestion) &&
    (isAnswerable || (!progress.isLeaderboardVisible && isBreakOrReveal));
  const openedQuestions = buildOpenedQuestions(
    seenQuestions,
    myAnswers,
    myAnswerGrades,
    team?.teamName ?? null,
    {
      status: progress.status,
      revealIndex: progress.revealIndex,
      revealQuestions,
    },
  );
  // Only the active block's questions can actually be jumped to in the
  // browser above — older, already-closed blocks aren't rendered there.
  const jumpableQuestionIds = showBlockBrowser
    ? new Set(blockQuestions.map((question) => question.id))
    : new Set<number>();
  const selectedQuestionPoints = selectedQuestion
    ? (openedQuestions.find((entry) => entry.id === selectedQuestion.id)
        ?.pointsAwarded ?? null)
    : null;
  // The mobile bonus bar is fixed to the viewport bottom (see
  // BonusProgressPanel), so the page needs matching bottom padding on mobile
  // or its bar would cover the last bit of inline content underneath it.
  const hasBonusPanel = settings.enabledBonusCategories.length > 0;

  return (
    <main
      className={`flex min-h-screen flex-col bg-background px-5 pt-1 text-foreground ${
        hasBonusPanel ? 'pb-24 md:pb-5' : 'pb-5'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">
          Playing as {teamName}
        </p>
        <Button
          type="button"
          variant="text-quiet"
          onClick={handleLogOut}
          className="hidden md:flex"
        >
          <ExitIcon aria-hidden="true" />
          Log out
        </Button>
      </div>
      {team && (
        <p className="mb-4 hidden flex-wrap items-center gap-1 text-xs text-foreground/45 md:flex">
          Team code: {team.teamCode}
          <CopyButton value={team.teamCode} /> — save it to play as this team
          another night.
        </p>
      )}
      {connectionError && (
        <p role="alert" className="mb-4 font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      <GameStatusScreens
        progress={progress}
        isAnswerable={isAnswerable}
        quizStructure={quizStructure}
        roundTitle={roundTitle}
        revealIntroRoundTitle={revealIntroRoundTitle}
        breakRoundIntroRoundTitle={breakRoundIntroRoundTitle}
        joinCode={snapshot.joinCode}
        rules={settings.rules}
        enabledBonusCategories={settings.enabledBonusCategories}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {showBlockBrowser && selectedQuestion && (
          <div className="md:min-w-0 md:flex-1">
            <QuestionBrowser
              progress={progress}
              isAnswerable={isAnswerable}
              team={team}
              pickerRounds={pickerRounds}
              totalPickerSlots={totalPickerSlots}
              selectedQuestion={selectedQuestion}
              revealQuestion={revealQuestion}
              closestGuessRevealStep={closestGuessRevealStep}
              myAnswers={myAnswers}
              myAnswerPoints={selectedQuestionPoints}
              onSelectQuestion={setBrowsedQuestionId}
              onSubmitAnswer={submitAnswer}
            />
          </div>
        )}
        {openedQuestions.length > 0 && (
          <AnsweredQuestionsPanel
            entries={openedQuestions}
            jumpableIds={jumpableQuestionIds}
            onSelectQuestion={setBrowsedQuestionId}
          />
        )}
        {hasBonusPanel && (
          <BonusProgressPanel
            enabledCategories={settings.enabledBonusCategories}
            maxAwardsPerCategory={settings.maxBonusAwardsPerCategory}
            myBonusAwards={myBonusAwards}
          />
        )}
      </div>
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
