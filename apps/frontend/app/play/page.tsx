'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { JoinForm } from '@/app/play/join-form';
import { QuestionBrowser } from '@/app/play/question-browser';
import { buildPickerRounds } from '@/app/play/question-picker';
import {
  JOIN_CODE_STORAGE_KEY,
  TEAM_CODE_STORAGE_KEY,
  TEAM_NAME_STORAGE_KEY,
  TEAM_TOKEN_STORAGE_KEY,
  clearStoredIdentity,
  normalizeJoinCode,
  storedJoinOptions,
} from '@/app/play/storage';

function PlayPageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') ?? '';
  const [teamName, setTeamName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState(codeFromUrl);
  const [teamCodeInput, setTeamCodeInput] = useState('');
  // Tracks whether this browser ever completed a real join (has a saved team
  // token) - distinguishes "reconnecting an existing team" from "typing a
  // name that happens to collide with someone else's team", which should not
  // offer a "Log out" button since there was never anything logged into.
  const [hasStoredIdentity, setHasStoredIdentity] = useState(false);
  // null = follow the question currently shown on the big screen.
  const [browsedQuestionId, setBrowsedQuestionId] = useState<number | null>(null);
  const {
    snapshot,
    team,
    connectionError,
    joinTeam,
    submitAnswer,
    myAnswers = {},
  } = useGameSocket('players');
  const gameStatus = snapshot?.progress.status;
  const currentQuestionId = snapshot?.currentQuestion?.id ?? null;

  useEffect(() => {
    // Snap back to the newest question whenever the quiz master reveals one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowsedQuestionId(null);
  }, [currentQuestionId]);

  useEffect(() => {
    // localStorage is unavailable during SSR, so the stored team name can only
    // be read after mount - this is the "synchronize with an external system"
    // case React's own docs carve out as a legitimate effect.
    const storedName = window.localStorage.getItem(TEAM_NAME_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamName(storedName);
    setHasStoredIdentity(Boolean(window.localStorage.getItem(TEAM_TOKEN_STORAGE_KEY)));
    if (storedName) {
      const storedOptions = storedJoinOptions();
      // Pre-fills the join form in case this reconnect attempt fails and we
      // fall back to showing it - the team shouldn't have to retype everything.
      setNameInput(storedName);
      if (storedOptions.joinCode) {
        setCodeInput(storedOptions.joinCode);
      }
      if (storedOptions.teamCode) {
        setTeamCodeInput(storedOptions.teamCode);
      }
      joinTeam(storedName, storedOptions);
    }
  }, [joinTeam]);

  useEffect(() => {
    if (team) {
      window.localStorage.setItem(TEAM_TOKEN_STORAGE_KEY, team.teamToken);
      window.localStorage.setItem(TEAM_CODE_STORAGE_KEY, team.teamCode);
    }
  }, [team]);

  useEffect(() => {
    // Back in the lobby means the admin may have started a fresh game session,
    // which invalidates the team registration. Re-joining is idempotent for
    // the same session and re-registers the team under a new one.
    if (gameStatus !== 'lobby' || !teamName) return;
    joinTeam(teamName, storedJoinOptions());
  }, [gameStatus, teamName, joinTeam]);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = nameInput.trim();
    const normalizedCode = normalizeJoinCode(codeInput);
    if (!trimmedName || !normalizedCode) return;
    window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, trimmedName);
    window.localStorage.setItem(JOIN_CODE_STORAGE_KEY, normalizedCode);
    setTeamName(trimmedName);
    joinTeam(trimmedName, {
      joinCode: normalizedCode,
      teamCode: teamCodeInput.trim() || undefined,
    });
  }

  function handleLogOut() {
    clearStoredIdentity();
    setTeamName(null);
    setNameInput('');
    setCodeInput(codeFromUrl);
    setTeamCodeInput('');
    setHasStoredIdentity(false);
  }

  if (!teamName || (connectionError && !team)) {
    return (
      <JoinForm
        nameInput={nameInput}
        onNameInputChange={setNameInput}
        codeInput={codeInput}
        onCodeInputChange={setCodeInput}
        teamCodeInput={teamCodeInput}
        onTeamCodeInputChange={setTeamCodeInput}
        connectionError={connectionError}
        hasStoredIdentity={hasStoredIdentity}
        onSubmit={handleJoin}
        onLogOut={handleLogOut}
      />
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
  // Falls back to the block's last question so the browser still has
  // something selected during break/reveal, when there's no currentQuestion.
  const selectedQuestion =
    blockQuestions.find((question) => question.id === browsedQuestionId) ??
    currentQuestion ??
    blockQuestions[blockQuestions.length - 1] ??
    null;
  // Answering stays available even while the leaderboard is toggled on for
  // the big screen — only a real lock (status leaving question_open/locking)
  // should stop teams from answering.
  const isAnswerable = progress.status === 'question_open' || progress.status === 'locking';
  const isBreakOrReveal = progress.status === 'break' || progress.status === 'reveal';
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
