'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  SessionSettings,
  UpdateSessionSettingsPayload,
} from '@campus-pubquiz/types';
import {
  LeagueCheckboxes,
  useTickableLeagues,
} from '@/app/components/league-checkboxes';
import { queryKeys } from '@/app/lib/query-keys';
import { SessionSettingsForm } from '@/app/components/session-settings-form';
import { SessionApiError, updateSessionSettings } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { Button } from '@/app/components/button';

interface SessionSettingsPanelProps {
  joinCode: string;
  settings: SessionSettings;
}

/** Lobby-only settings editor — any field can keep changing right up until START_QUIZ locks them in. */
export function SessionSettingsPanel({
  joinCode,
  settings,
}: SessionSettingsPanelProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<SessionSettings>(settings);
  // Leagues ticked by hand; null until the first tick, so an untouched panel
  // shows (and saves) the session's existing memberships unchanged.
  const [pickedLeagueIds, setPickedLeagueIds] = useState<number[] | null>(null);
  const { leagues, memberOf } = useTickableLeagues(joinCode);

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
      <SessionSettingsForm value={value} onChange={setValue} />
      <LeagueCheckboxes
        leagues={leagues}
        selected={pickedLeagueIds ?? memberOf}
        onChange={setPickedLeagueIds}
      />
      <Button
        type="button"
        disabled={saveMutation.isPending}
        variant="solid-flat"
        size="md"
        onClick={() =>
          saveMutation.mutate(
            pickedLeagueIds === null
              ? value
              : { ...value, leagueIds: pickedLeagueIds },
          )
        }
        className="w-fit self-end disabled:opacity-40"
      >
        {saveMutation.isPending ? 'Saving…' : 'Save'}
      </Button>
    </section>
  );
}
