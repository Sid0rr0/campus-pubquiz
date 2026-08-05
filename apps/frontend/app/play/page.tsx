'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGameSocket } from '@/app/lib/use-game-socket';
import { GameStatusScreens } from '@/app/play/game-status-screens';
import { JoinForm } from '@/app/play/join-form';
import { QuestionBrowser } from '@/app/play/question-browser';
import { buildPickerRounds } from '@/app/play/question-picker-slots';
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
  // The session this connection is pinned to — from the URL up front, or
  // filled in once storage/the join form supplies one. The socket only
  // connects once this is known, so a fresh visitor with no code yet doesn't
  // land in the server's single implicit "default" session by accident.
  const [activeJoinCode, setActiveJoinCode] = useState<string | null>(codeFromUrl || null);
  // Bumped on every form submission so the join effect below re-fires even
  // when the submitted name/code are unchanged from the last attempt — e.g.
  // retrying after a name-collision error with only the team code field
  // corrected, where teamName/activeJoinCode wouldn't otherwise change.
  const [joinAttempt, setJoinAttempt] = useState(0);
  // Always holds the latest typed team code without making the join effect
  // below re-fire on every keystroke (it should only fire on an actual
  // identity/session/attempt change).
  const teamCodeInputRef = useRef(teamCodeInput);
  useEffect(() => {
    teamCodeInputRef.current = teamCodeInput;
  });
  const {
    snapshot,
    team,
    connectionError,
    joinTeam,
    submitAnswer,
    myAnswers = {},
  } = useGameSocket('players', Boolean(activeJoinCode), activeJoinCode ?? undefined);
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
        // Only fills the gap when the URL didn't already pin a code — the URL
        // is the stronger signal (e.g. a fresh QR scan for a different game).
        setActiveJoinCode((current) => current ?? storedOptions.joinCode ?? null);
      }
      if (storedOptions.teamCode) {
        setTeamCodeInput(storedOptions.teamCode);
      }
    }
    // The actual joinTeam call happens in the effect below, once the socket
    // for activeJoinCode has had a chance to connect — calling it here would
    // race the socket's own connecting effect when the code only came from
    // storage (see the effect below for the full explanation).
  }, []);

  useEffect(() => {
    // Fires once this connection's identity (team name + session code) is
    // known, whichever of the join form / stored identity / URL supplied it —
    // and again on every joinAttempt bump, so resubmitting the form with the
    // same name/code (e.g. only the team code field corrected after a
    // collision error) still re-sends the join instead of being a no-op.
    // Deliberately excludes teamCodeInput itself from its deps (read via a
    // ref instead) so retyping the team code alone doesn't re-fire this join.
    if (!teamName || !activeJoinCode) return;
    const storedOptions = storedJoinOptions();
    joinTeam(teamName, {
      teamToken: storedOptions.teamToken,
      teamCode: teamCodeInputRef.current.trim() || storedOptions.teamCode,
      joinCode: activeJoinCode,
    });
  }, [teamName, activeJoinCode, joinAttempt, joinTeam]);

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
    setActiveJoinCode(normalizedCode);
    setJoinAttempt((count) => count + 1);
  }

  function handleLogOut() {
    clearStoredIdentity();
    setTeamName(null);
    setNameInput('');
    setCodeInput(codeFromUrl);
    setTeamCodeInput('');
    setHasStoredIdentity(false);
    setActiveJoinCode(codeFromUrl || null);
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
