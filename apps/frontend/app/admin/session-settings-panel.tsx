'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { SessionSettings } from '@campus-pubquiz/types';
import { SessionSettingsForm } from '@/app/components/session-settings-form';
import { SessionApiError, updateSessionSettings } from '@/app/lib/sessions-api';

interface SessionSettingsPanelProps {
  joinCode: string;
  settings: SessionSettings;
}

/** Lobby-only settings editor — any field can keep changing right up until START_QUIZ locks them in. */
export function SessionSettingsPanel({
  joinCode,
  settings,
}: SessionSettingsPanelProps) {
  const [value, setValue] = useState<SessionSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  // Re-seeds local edits from the live settings whenever the admin switches
  // sessions, or whenever the settings reference itself changes (e.g. saved
  // from another open admin tab) — adjusted during render rather than in an
  // Effect, the same idiom AdminPageContent already uses for its own
  // session-switch resets. Safe against unrelated snapshot broadcasts (a
  // team joining, etc.) because GameStateService only reassigns
  // seededGame.settings when settings actually change.
  const [prevJoinCode, setPrevJoinCode] = useState(joinCode);
  const [prevSettings, setPrevSettings] = useState(settings);
  if (joinCode !== prevJoinCode || settings !== prevSettings) {
    setPrevJoinCode(joinCode);
    setPrevSettings(settings);
    setValue(settings);
  }

  function handleSave(): void {
    setIsSaving(true);
    updateSessionSettings(joinCode, value)
      .catch((error: unknown) => {
        toast.error(
          error instanceof SessionApiError
            ? error.message
            : 'Could not save settings',
        );
      })
      .finally(() => setIsSaving(false));
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-white p-4">
      <h2 className="font-display text-xl">Session Settings</h2>
      <SessionSettingsForm value={value} onChange={setValue} />
      <button
        type="button"
        disabled={isSaving}
        onClick={handleSave}
        className="flex min-h-10 w-fit items-center gap-1.5 self-end rounded-lg bg-magenta px-4 text-sm font-extrabold text-white disabled:opacity-40"
      >
        {isSaving ? 'Saving…' : 'Save'}
      </button>
    </section>
  );
}
