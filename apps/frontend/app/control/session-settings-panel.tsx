'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'radix-ui';
import { toast } from 'sonner';
import {
  quizModeAllows,
  settingsToSend,
  type QuizMode,
  type SessionSettings,
  type UpdateSessionSettingsPayload,
} from '@campus-pubquiz/types';
import {
  LeagueCheckboxes,
  useTickableLeagues,
} from '@/app/components/league-checkboxes';
import { queryKeys } from '@/app/lib/query-keys';
import { PowerUpsSettingsForm } from '@/app/components/power-ups-settings-form';
import { SessionSettingsForm } from '@/app/components/session-settings-form';
import { SessionApiError, updateSessionSettings } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { Button } from '@/app/components/button';

interface SessionSettingsPanelProps {
  joinCode: string;
  settings: SessionSettings;
  /** The session's quiz mode: decides which settings show and are sent. */
  mode: QuizMode;
}

/** Lobby-only settings editor — any field can keep changing right up until START_QUIZ locks them in. */
export function SessionSettingsPanel({
  joinCode,
  settings,
  mode,
}: SessionSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<SessionSettings>(settings);
  // Leagues ticked by hand; null until the first tick, so an untouched panel
  // shows (and saves) the session's existing memberships unchanged.
  const [pickedLeagueIds, setPickedLeagueIds] = useState<number[] | null>(null);
  const { leagues, memberOf } = useTickableLeagues(joinCode);

  // Re-seeds local edits from the live settings whenever the admin switches
  // sessions, or whenever the settings' contents change (e.g. saved from
  // another open admin tab) — adjusted during render rather than in an
  // Effect, the same idiom AdminPageContent already uses for its own
  // session-switch resets. Compared by content: every snapshot broadcast (a
  // team joining, etc.) arrives as a fresh object, so a reference check
  // would wipe unsaved edits.
  const [prevJoinCode, setPrevJoinCode] = useState(joinCode);
  const [prevSettingsJson, setPrevSettingsJson] = useState(() =>
    JSON.stringify(settings),
  );
  const settingsJson = JSON.stringify(settings);
  if (joinCode !== prevJoinCode || settingsJson !== prevSettingsJson) {
    setPrevJoinCode(joinCode);
    setPrevSettingsJson(settingsJson);
    setValue(settings);
    if (joinCode !== prevJoinCode) setPickedLeagueIds(null);
  }

  const saveMutation = useMutation({
    mutationFn: (next: UpdateSessionSettingsPayload) =>
      updateSessionSettings(joinCode, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leagues.all });
    },
    onError: (error) =>
      toast.error(
        apiErrorMessage(error, SessionApiError, 'Could not save settings') ??
          'Could not save settings',
      ),
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-foreground/15 bg-white p-4">
      <h2 className="font-display text-xl">Session Settings</h2>
      <Tabs.Root defaultValue="settings" className="flex flex-col gap-3">
        <Tabs.List className="flex gap-1 border-b border-foreground/15">
          {tabsFor(mode).map(([tab, label]) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className="min-h-10 border-b-2 border-transparent px-3 text-sm font-extrabold text-foreground/55 data-[state=active]:border-magenta data-[state=active]:text-foreground"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="settings">
          <SessionSettingsForm value={value} onChange={setValue} mode={mode} />
        </Tabs.Content>
        {quizModeAllows(mode, 'powerUps') && (
          <Tabs.Content value="power-ups">
            <PowerUpsSettingsForm value={value} onChange={setValue} />
          </Tabs.Content>
        )}
      </Tabs.Root>
      {quizModeAllows(mode, 'leagues') && (
        <LeagueCheckboxes
          leagues={leagues}
          selected={pickedLeagueIds ?? memberOf}
          onChange={setPickedLeagueIds}
        />
      )}
      <Button
        type="button"
        disabled={saveMutation.isPending}
        variant="solid-flat"
        size="md"
        onClick={() =>
          saveMutation.mutate(savePayload(value, pickedLeagueIds, mode))
        }
        className="w-fit self-end disabled:opacity-40"
      >
        {saveMutation.isPending ? 'Saving…' : 'Save'}
      </Button>
    </section>
  );
}

/** A mode without power-ups has no tab for them. */
function tabsFor(mode: QuizMode): string[][] {
  return quizModeAllows(mode, 'powerUps')
    ? [
        ['settings', 'Settings'],
        ['power-ups', 'Power-ups'],
      ]
    : [['settings', 'Settings']];
}

/** What Save sends: the settings the mode allows and, once ticked by hand, the leagues. */
function savePayload(
  value: SessionSettings,
  pickedLeagueIds: number[] | null,
  mode: QuizMode,
): UpdateSessionSettingsPayload {
  const settings = settingsToSend(mode, value);
  return pickedLeagueIds === null
    ? settings
    : { ...settings, leagueIds: pickedLeagueIds };
}
