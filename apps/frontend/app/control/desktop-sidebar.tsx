import { NavigationButtons } from '@/app/control/navigation-buttons';
import { PanelControls, PanelTeams } from '@/app/control/panel-controls';
import { PhaseTimer } from '@/app/control/phase-timer';
import { SessionStatusPanel } from '@/app/control/session-status-panel';
import type { ControlPanel } from '@/app/control/control-panel';

/** Always-visible quiz master panel — desktop only (the mobile drawer covers the same actions via MobileAdminBar). */
export function DesktopSidebar({ panel }: { panel: ControlPanel }) {
  const { view, quiz, connectionError, actions } = panel;
  const { progress } = view;
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto bg-foreground p-5 text-background md:sticky md:top-(--site-header-height) md:flex md:h-[calc(100vh-var(--site-header-height))]">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg">Quiz Master</h1>
        <PhaseTimer
          phaseStartedAt={view.phaseStartedAt}
          phaseElapsedMs={view.phaseElapsedMs}
        />
      </div>
      <SessionStatusPanel
        progressStatus={progress.status}
        roundIndex={progress.roundIndex}
        questionIndex={progress.questionIndex}
        joinCode={view.joinCode}
        activeQuizTitle={quiz.title}
        connectionError={connectionError}
      />
      <div className="flex flex-col gap-2">
        <NavigationButtons
          progressStatus={progress.status}
          advanceStep={view.advanceStep}
          previousState={view.previousState}
          onAction={actions.sendAction}
        />
        <PanelControls panel={panel} />
      </div>
      <PanelTeams panel={panel} />
    </aside>
  );
}
