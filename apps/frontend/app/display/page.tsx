'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import {
  clearStoredDisplayCode,
  readStoredDisplayCode,
  storeDisplayCode,
} from '@/app/lib/display-code-storage';
import { useDisplayGame } from '@/app/lib/use-display-game';
import { useDisplayScreenSounds } from '@/app/lib/use-display-screen-sounds';
import { useDisplaySoundMuted } from '@/app/lib/use-display-sound-muted';
import { useLockCountdownSound } from '@/app/lib/use-lock-countdown-sound';
import { DisplayScreenView } from '@/app/components/display-screen-view';
import { EnableSoundButton } from '@/app/components/enable-sound-button';
import { DisplaySessionPicker } from '@/app/display/display-session-picker';
import { TriviaHeader } from '@/app/display/trivia-header';

function DisplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The query parameter pins this connection to a specific game session's
  // code (e.g. a pre-printed URL or a picked session below). No fallback to
  // an implicit "default" session — once more than one game can run at
  // once that would silently point the screen at the wrong game.
  const codeFromUrl = searchParams.get('code') ?? undefined;
  const { snapshot, connectionError, connectionIssue } = useDisplayGame(
    Boolean(codeFromUrl),
    codeFromUrl,
  );
  const isRefused = connectionIssue === 'refused';
  const isConnected = snapshot !== null && !connectionError;
  const isCountdownSoundOn =
    snapshot?.settings.playLockCountdownSound ??
    DEFAULT_SESSION_SETTINGS.playLockCountdownSound;
  // One countdown track serves the block's lock and the joker pick; the two
  // never run at once.
  const { needsUnlock: needsSoundUnlock, unlock: unlockSound } =
    useLockCountdownSound({
      lockAt: snapshot?.questionLockAt ?? snapshot?.jokerPickEndsAt ?? null,
      enabled: isCountdownSoundOn,
      isMuted: snapshot?.isDisplaySoundMuted ?? false,
      isRegistryInUse: true,
    });
  // Set once the final leaderboard has crowned the winner, so Quiz complete
  // doesn't play the same fanfare and confetti a second time.
  const hasWinnerBeenCelebratedRef = useRef(false);
  // Round sting, reveal sting, time-up and the fanfare with confetti follow
  // the Display screen the room sees, on a live forward move only.
  useDisplayScreenSounds(
    snapshot,
    isConnected,
    hasWinnerBeenCelebratedRef,
    isCountdownSoundOn,
  );

  useDisplaySoundMuted(snapshot?.isDisplaySoundMuted ?? false);

  // A bare /display resumes the game this screen last showed, once, on load.
  const hasTriedResumeRef = useRef(false);
  useEffect(() => {
    if (hasTriedResumeRef.current) return;
    hasTriedResumeRef.current = true;
    if (codeFromUrl) return;
    const storedCode = readStoredDisplayCode();
    if (storedCode) router.replace(`/display?code=${storedCode}`);
  }, [codeFromUrl, router]);

  // A code the server has really served is the one to resume after a reload.
  const hasSnapshot = snapshot !== null;
  useEffect(() => {
    if (codeFromUrl && hasSnapshot) storeDisplayCode(codeFromUrl);
  }, [codeFromUrl, hasSnapshot]);

  // An unknown/stale code (e.g. a pre-printed QR for a session that's since
  // ended) silently falls back to the plain picker rather than surfacing a
  // "connection error" for what's normal end-of-game cleanup — this forgets
  // the code and strips the bad ?code= from the address bar. A transient
  // drop (`reconnecting`) is not a refusal: socket.io retries on its own.
  useEffect(() => {
    if (codeFromUrl && isRefused) {
      clearStoredDisplayCode();
      router.replace('/display');
    }
  }, [codeFromUrl, isRefused, router]);

  function pickAnotherGame() {
    clearStoredDisplayCode();
    router.replace('/display');
  }

  if (!codeFromUrl || isRefused) {
    return (
      <DisplaySessionPicker
        onSelectSession={(joinCode) =>
          router.replace(`/display?code=${joinCode}`)
        }
      />
    );
  }

  if (!snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-display text-2xl text-foreground">Connecting…</p>
      </main>
    );
  }

  const {
    progress,
    quizStructure,
    leaderboard,
    teams,
    answeredTeamIds,
    roundTitles,
    roundCategories,
    roundAuthors,
    kahootQuestionEndsAt,
    teamsCorrect,
    leagueTop,
    displayTextScale,
    settings,
    screen,
    screenKey,
    header: headerContent,
    isDisplaySoundMuted,
  } = snapshot;

  return (
    <main
      className="flex h-dvh flex-col bg-background text-foreground"
      style={
        { '--display-text-scale': displayTextScale } as React.CSSProperties
      }
    >
      {connectionIssue === 'reconnecting' && (
        <p
          role="status"
          className="fixed right-4 bottom-4 z-50 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          Reconnecting…
        </p>
      )}
      {needsSoundUnlock && <EnableSoundButton onClick={unlockSound} />}
      <TriviaHeader
        label={headerContent.label}
        title={headerContent.title}
        badge={headerContent.badge}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKey}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DisplayScreenView
            screen={screen}
            quiz={{
              settings,
              quizStructure,
              roundTitles,
              roundCategories,
              roundAuthors,
            }}
            live={{
              teams,
              answeredTeamIds,
              leaderboard,
              leagueTop,
              teamsCorrect,
              joinCode: codeFromUrl,
              isConnected,
              isMediaFullscreen: progress.isMediaFullscreen,
              isMediaPaused: progress.isMediaPaused,
              isDisplaySoundMuted,
              mediaReplayToken: progress.mediaReplayToken,
              kahootQuestionEndsAt,
              onPickAnotherGame: pickAnotherGame,
              onWinnerCelebrated: () => {
                hasWinnerBeenCelebratedRef.current = true;
              },
            }}
          />
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

export default function DisplayPage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <DisplayPageContent />
    </Suspense>
  );
}
