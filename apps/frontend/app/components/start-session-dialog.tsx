'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, Tabs } from 'radix-ui';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import {
  DEFAULT_KAHOOT_QUESTION_TIMER_SECONDS,
  DEFAULT_SESSION_SETTINGS,
  type QuizSummary,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { createSession, SessionApiError } from '@/app/lib/sessions-api';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import { Button } from '@/app/components/button';
import { RoundsList } from '@/app/components/rounds-list';
import { SessionSettingsForm } from '@/app/components/session-settings-form';

interface StartSessionDialogProps {
  /** The quiz to start a session from; `null` keeps the dialog closed. */
  quiz: QuizSummary | null;
  onClose: () => void;
  /** Called with the new session's join code once it has been created. */
  onCreated: (joinCode: string) => void;
}

/** Confirmation dialog for starting a session: session name, a quiz overview tab and a settings tab. */
export function StartSessionDialog({
  quiz,
  onClose,
  onCreated,
}: StartSessionDialogProps) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SessionSettings>(
    DEFAULT_SESSION_SETTINGS,
  );
  const [name, setName] = useState('');
  // Resets the form whenever a different (or no) quiz becomes pending —
  // adjusted during render rather than in an Effect.
  const [prevQuizId, setPrevQuizId] = useState(quiz?.id ?? null);
  if ((quiz?.id ?? null) !== prevQuizId) {
    setPrevQuizId(quiz?.id ?? null);
    setSettings({
      ...DEFAULT_SESSION_SETTINGS,
      kahootQuestionTimerSeconds: quiz?.rounds.some((round) => round.kahootMode)
        ? DEFAULT_KAHOOT_QUESTION_TIMER_SECONDS
        : null,
    });
    setName(quiz?.title ?? '');
  }

  const createMutation = useMutation({
    mutationFn: (variables: {
      quizId: number;
      settings: SessionSettings;
      name: string;
    }) => createSession(variables.quizId, variables.settings, variables.name),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      onCreated(session.joinCode);
    },
    onError: (createError) =>
      toast.error(
        apiErrorMessage(
          createError,
          SessionApiError,
          'Could not start session',
        ) ?? 'Could not start session',
      ),
    onSettled: () => onClose(),
  });

  function handleConfirm(): void {
    if (!quiz) return;
    createMutation.mutate({ quizId: quiz.id, settings, name });
  }

  return (
    <Dialog.Root
      open={quiz !== null}
      onOpenChange={(open) => {
        if (!open && !createMutation.isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-40 flex max-h-[85vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl bg-white p-5">
          <Dialog.Title className="font-display text-xl">
            Start &quot;{quiz?.title}&quot;?
          </Dialog.Title>
          <label className="flex flex-col gap-1 text-sm font-extrabold">
            Session name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={quiz?.title ?? ''}
              className="min-h-10 rounded-lg border border-foreground/20 px-3 text-sm font-normal"
            />
          </label>
          <Tabs.Root defaultValue="overview" className="flex flex-col gap-3">
            <Tabs.List className="flex gap-1 border-b border-foreground/15">
              <Tabs.Trigger
                value="overview"
                className="min-h-10 border-b-2 border-transparent px-3 text-sm font-extrabold text-foreground/55 data-[state=active]:border-magenta data-[state=active]:text-foreground"
              >
                Overview
              </Tabs.Trigger>
              <Tabs.Trigger
                value="settings"
                className="min-h-10 border-b-2 border-transparent px-3 text-sm font-extrabold text-foreground/55 data-[state=active]:border-magenta data-[state=active]:text-foreground"
              >
                Settings
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="overview">
              {quiz && <RoundsList rounds={quiz.rounds} />}
            </Tabs.Content>
            <Tabs.Content value="settings">
              <SessionSettingsForm value={settings} onChange={setSettings} />
            </Tabs.Content>
          </Tabs.Root>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              disabled={createMutation.isPending}
              variant="outline-muted"
              size="md"
              onClick={onClose}
            >
              <Cross2Icon aria-hidden="true" />
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending}
              variant="solid-flat"
              size="md"
              onClick={handleConfirm}
              className="disabled:opacity-40"
            >
              <CheckIcon aria-hidden="true" />
              {createMutation.isPending ? 'Starting…' : 'Confirm'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
