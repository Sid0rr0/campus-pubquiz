'use client';

import { Suspense } from 'react';
import {
  DEFAULT_DISPLAY_TEXT_SCALE,
  isRoundNoteScreen,
  type PresenterContextPayload,
  type SeededQuestion,
  type ScreenPreview,
} from '@campus-pubquiz/types';
import { useAdminSession } from '@/app/lib/use-admin-session';
import { NavigationButtons } from '@/app/control/navigation-buttons';
import { MediaFullscreenToggle } from '@/app/control/media-fullscreen-toggle';
import { MediaPauseButton } from '@/app/control/media-pause-button';
import { ReplayMediaButton } from '@/app/control/replay-media-button';
import { PhaseTimer } from '@/app/control/phase-timer';
import { DisplayTextScaleControl } from '@/app/control/display-text-scale-control';
import { getAdminControls } from '@/app/control/admin-controls';
import { useAdminMediaPauseShortcut } from '@/app/control/use-admin-keyboard-shortcuts';
import { countCorrectAnswers } from '@/app/lib/count-correct-answers';

function NextQuestionPreview({ question }: { question: SeededQuestion }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-bold">{question.prompt}</p>
      {question.options && question.options.length > 0 && (
        <ul className="list-disc pl-5">
          {question.options.map((option) => (
            <li key={option}>{option}</li>
          ))}
        </ul>
      )}
      {question.mediaUrl && (
        <p className="text-xs break-all text-foreground/70">
          Media: {question.mediaUrl}
        </p>
      )}
      <p className="text-xs text-foreground/70">
        Answer: <span className="font-bold">{question.answer}</span>
      </p>
    </div>
  );
}

// The heading (e.g. "R1 Q2") and, when the screen is a question, its type +
// points — pulled out of the card body so it can sit on the same line as
// the section's own "On display"/"Up next" label instead of its own row.
function ScreenSummaryLine({ screen }: { screen: ScreenPreview }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-bold">{screen.heading}</span>
      {screen.question && (
        <span className="text-xs font-extrabold tracking-wide text-magenta uppercase">
          {screen.question.type.replace(/_/g, ' ')} — {screen.question.points}{' '}
          pt
          {screen.question.points === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}

function ScreenPreviewCard({ screen }: { screen: ScreenPreview }) {
  return screen.question ? (
    <NextQuestionPreview question={screen.question} />
  ) : (
    screen.body && <p className="text-sm text-foreground/70">{screen.body}</p>
  );
}

/** Question notes when a question is on the big screen, the round note on a round intro, break round intro or reveal intro, else the empty state. */
function NotesBody({
  presenterContext,
  isRoundNoteOnAir,
}: {
  presenterContext: PresenterContextPayload | null;
  isRoundNoteOnAir: boolean;
}) {
  const roundNote = presenterContext?.currentRoundNote;
  if (roundNote) {
    return <p className="text-sm whitespace-pre-line">{roundNote}</p>;
  }
  if (isRoundNoteOnAir) {
    return (
      <p className="text-sm text-foreground/50">No note for this round.</p>
    );
  }
  if (presenterContext?.currentQuestionNotes) {
    return <p className="text-sm">{presenterContext.currentQuestionNotes}</p>;
  }
  return (
    <p className="text-sm text-foreground/50">No notes for this question.</p>
  );
}

function RemotePageContent() {
  const {
    snapshot,
    connectionError,
    sendAction,
    presenterContext,
    liveAnswers,
    setDisplayTextScale,
    isLoading,
  } = useAdminSession('/remote');
  const canPauseMedia = snapshot
    ? getAdminControls(snapshot).canPauseMedia
    : false;
  useAdminMediaPauseShortcut({ canPauseMedia, sendAction });

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

  const {
    progress,
    onAirScreen,
    teams = [],
    answeredTeamIds = [],
    displayTextScale = DEFAULT_DISPLAY_TEXT_SCALE,
    phaseStartedAt = null,
    phaseElapsedMs = null,
  } = snapshot;
  const isMediaFullscreen = progress.isMediaFullscreen ?? false;
  const gameStatus = progress.status;
  const isMediaPaused = progress.isMediaPaused ?? false;
  const { canReplayMedia, showAnswerStatus } = getAdminControls(snapshot);
  const hasMediaRow = canReplayMedia || canPauseMedia;
  // What Advance and Previous do is announced by the server (the admin view),
  // so the presenter's phone shows the buttons exactly as the admin console.
  const { advanceStep, previousState } = snapshot;

  return (
    <main
      className={`flex min-h-screen flex-col gap-2 bg-background p-2 pt-0 text-foreground ${
        hasMediaRow ? 'pb-40' : 'pb-28'
      }`}
    >
      {connectionError && (
        <p role="alert" className="font-extrabold text-magenta">
          {connectionError}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex gap-4 items-center justify-between">
          {showAnswerStatus && (
            <p className="text-sm font-bold text-cyan">
              {answeredTeamIds.length}/{teams.length} teams answered
            </p>
          )}
          {liveAnswers && (
            <p className="text-sm font-bold text-cyan">
              {countCorrectAnswers(liveAnswers)} correct
            </p>
          )}
          <PhaseTimer
            phaseStartedAt={phaseStartedAt}
            phaseElapsedMs={phaseElapsedMs}
          />
        </div>
      </div>

      <section
        aria-labelledby="remote-on-display"
        className="flex flex-col gap-2 rounded-lg border-2 border-foreground/10 p-3"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="remote-on-display"
            className="text-xs font-extrabold tracking-wide text-magenta uppercase"
          >
            On display
          </h2>
          {presenterContext && (
            <ScreenSummaryLine screen={presenterContext.currentScreen} />
          )}
        </div>
        {presenterContext ? (
          <ScreenPreviewCard screen={presenterContext.currentScreen} />
        ) : (
          <p className="text-sm text-foreground/50">Loading…</p>
        )}
      </section>

      <section
        aria-labelledby="remote-notes"
        className="flex flex-col gap-2 rounded-lg border-2 border-foreground/10 p-3"
      >
        <h2
          id="remote-notes"
          className="text-xs font-extrabold tracking-wide text-magenta uppercase"
        >
          Notes
        </h2>
        <NotesBody
          presenterContext={presenterContext}
          isRoundNoteOnAir={isRoundNoteScreen(onAirScreen)}
        />
      </section>

      <section
        aria-labelledby="remote-up-next"
        className="flex flex-col gap-2 rounded-lg border-2 border-foreground/10 p-3"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="remote-up-next"
            className="text-xs font-extrabold tracking-wide text-magenta uppercase"
          >
            Up next
          </h2>
          {presenterContext?.nextScreen && (
            <ScreenSummaryLine screen={presenterContext.nextScreen} />
          )}
        </div>
        {presenterContext?.nextScreen ? (
          <ScreenPreviewCard screen={presenterContext.nextScreen} />
        ) : (
          <p className="text-sm text-foreground/50">Nothing queued yet.</p>
        )}
      </section>

      <DisplayTextScaleControl
        displayTextScale={displayTextScale}
        onSetDisplayTextScale={setDisplayTextScale}
      />

      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t-2 border-foreground/10 bg-background p-3">
        {hasMediaRow && (
          <div className="flex gap-2">
            <ReplayMediaButton
              canReplay={canReplayMedia}
              onAction={sendAction}
            />
            <MediaPauseButton
              canPause={canPauseMedia}
              isPaused={isMediaPaused}
              onAction={sendAction}
            />
          </div>
        )}
        <NavigationButtons
          progressStatus={gameStatus}
          advanceStep={advanceStep}
          previousState={previousState}
          onAction={sendAction}
        >
          <MediaFullscreenToggle
            isMediaFullscreen={isMediaFullscreen}
            onAction={sendAction}
          />
        </NavigationButtons>
      </div>
    </main>
  );
}

export default function RemotePage() {
  // useSearchParams requires a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <RemotePageContent />
    </Suspense>
  );
}
