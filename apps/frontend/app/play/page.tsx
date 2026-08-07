'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { JoinForm } from '@/app/components/join-form';
import { QuestionBrowser } from '@/app/play/question-browser';
import { buildPickerRounds } from '@/app/play/question-picker-slots';
import { useTeamJoin } from '@/app/lib/use-team-join';
import { storedJoinOptions } from '@/app/lib/team-storage';

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
    handleJoin,
    handleLogOut,
  } = useTeamJoin(codeFromUrl);
  // null = follow the question currently shown on the big screen.
  const [browsedQuestionId, setBrowsedQuestionId] = useState<number | null>(null);
  const gameStatus = snapshot?.progress.status;
  const currentQuestionId = snapshot?.currentQuestion?.id ?? null;

  useEffect(() => {
    // Snap back to the newest question whenever the quiz master reveals one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowsedQuestionId(null);
  }, [currentQuestionId]);

  useEffect(() => {
    // Back in the lobby means the admin may have started a fresh game session,
    // which invalidates the team registration. Re-joining is idempotent for
    // the same session and re-registers the team under a new one.
    if (gameStatus !== 'lobby' || !teamName) return;
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
        <h1 className="text-center font-display text-3xl text-magenta">🍺 Join the quiz</h1>
        <p className="-mt-2 text-center text-sm text-foreground/65">Grab a table, pick a name</p>
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
        />
        {hasStoredIdentity && (
          <button
            type="button"
            onClick={handleLogOut}
            className="mx-auto text-xs font-extrabold text-foreground/45 underline"
          >
            Log out
          </button>
        )}
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-foreground">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">Playing as {teamName}</p>
        <p className="font-display text-xl">Connecting…</p>
        <button
          type="button"
          onClick={handleLogOut}
          className="text-xs font-extrabold text-foreground/45 underline"
        >
          Log out
        </button>
      </main>
    );
  }

  const {
    progress,
    currentQuestion,
    blockQuestions = [],
    upcomingQuestions = [],
    quizStructure = { blockCount: 0, topicsPerBlock: null },
    roundTitle = '',
  } = snapshot;
  const pickerRounds = buildPickerRounds(blockQuestions, upcomingQuestions);
  const totalPickerSlots = blockQuestions.length + upcomingQuestions.length;
  // Defaults to the block's last (furthest-ever-opened) question rather than
  // currentQuestion, which tracks the display's literal position - stepping
  // the display backward with PREVIOUS must not drag /play's default view
  // back with it, since teams should keep answering the newest question.
  const selectedQuestion =
    blockQuestions.find((question) => question.id === browsedQuestionId) ??
    blockQuestions[blockQuestions.length - 1] ??
    currentQuestion ??
    null;
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
  // The block browser (question picker + prompt) stays up through break/reveal
  // too, so teams can review the block they just answered — unless the
  // leaderboard overlay is toggled on, which takes over the screen instead.
  const showBlockBrowser =
    Boolean(selectedQuestion) && (isAnswerable || (!progress.isLeaderboardVisible && isBreakOrReveal));

  return (
    <main className="flex min-h-screen flex-col bg-background px-5 py-5 text-foreground">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold tracking-wide text-foreground/55">Playing as {teamName}</p>
        <button
          type="button"
          onClick={handleLogOut}
          className="text-xs font-extrabold text-foreground/45 underline"
        >
          Log out
        </button>
      </div>
      {team && (
        <p className="mb-4 text-xs text-foreground/45">
          Team code: {team.teamCode} — save it to play as this team another night.
        </p>
      )}
      <GameStatusScreens
        progress={progress}
        isAnswerable={isAnswerable}
        quizStructure={quizStructure}
        roundTitle={roundTitle}
      />
      {showBlockBrowser && selectedQuestion && (
        <QuestionBrowser
          progress={progress}
          isAnswerable={isAnswerable}
          team={team}
          pickerRounds={pickerRounds}
          totalPickerSlots={totalPickerSlots}
          selectedQuestion={selectedQuestion}
          myAnswers={myAnswers}
          onSelectQuestion={setBrowsedQuestionId}
          onSubmitAnswer={submitAnswer}
        />
      )}
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
