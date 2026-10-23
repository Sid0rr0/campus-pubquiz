'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  TeamMergeCandidate,
  TeamMergeRefusal,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';
import { apiErrorMessage } from '@/app/lib/api-error-message';
import { queryKeys } from '@/app/lib/query-keys';
import {
  fetchMergeCandidates,
  fetchMergePair,
  mergeTeams,
  TeamsApiError,
} from '@/app/lib/teams-api';

function refusalText(refusal: TeamMergeRefusal): string {
  return refusal.kind === 'shared_session'
    ? `both took part in ${refusal.sessionNames.join(', ')}`
    : `${refusal.teamName} is in a session that hasn't ended`;
}

interface TeamMergePanelProps {
  teamId: number;
}

/** Staff merge of this team with a duplicate: pick the other team, choose the name, confirm. */
export function TeamMergePanel({ teamId }: TeamMergePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [otherTeamId, setOtherTeamId] = useState<number | null>(null);

  if (!isOpen) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
        >
          Merge with…
        </Button>
      </div>
    );
  }

  function close(): void {
    setIsOpen(false);
    setSearch('');
    setOtherTeamId(null);
  }

  return (
    <section className="flex max-w-xl flex-col gap-3 rounded-xl border-2 border-foreground/20 p-4">
      <h2 className="font-display text-lg">Merge with another team</h2>
      {otherTeamId === null ? (
        <TeamPicker
          teamId={teamId}
          search={search}
          onSearch={setSearch}
          onPick={setOtherTeamId}
          onCancel={close}
        />
      ) : (
        <MergeConfirm
          teamId={teamId}
          otherTeamId={otherTeamId}
          onBack={() => setOtherTeamId(null)}
        />
      )}
    </section>
  );
}

function TeamPicker({
  teamId,
  search,
  onSearch,
  onPick,
  onCancel,
}: {
  teamId: number;
  search: string;
  onSearch: (search: string) => void;
  onPick: (otherTeamId: number) => void;
  onCancel: () => void;
}) {
  const candidatesQuery = useQuery({
    queryKey: queryKeys.teams.mergeCandidates(teamId),
    queryFn: ({ signal }) => fetchMergeCandidates(teamId, signal),
  });
  const error = apiErrorMessage(
    candidatesQuery.error,
    TeamsApiError,
    'Could not load the other teams',
  );
  const needle = search.trim().toLowerCase();
  const shown: TeamMergeCandidate[] = (
    candidatesQuery.data?.candidates ?? []
  ).filter((candidate) => candidate.name.toLowerCase().includes(needle));

  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Search teams
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="rounded-lg border-2 border-foreground/30 bg-transparent px-3 py-2 font-normal"
        />
      </label>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {shown.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              disabled={candidate.refusal !== null}
              onClick={() => onPick(candidate.id)}
              className="flex w-full flex-col rounded-lg border-2 border-foreground/20 px-3 py-2 text-left disabled:opacity-40"
            >
              <span className="font-bold">{candidate.name}</span>
              <span className="text-xs text-foreground/60">
                {candidate.sessionsPlayed} sessions played
                {candidate.refusal &&
                  ` — can't merge: ${refusalText(candidate.refusal)}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {candidatesQuery.data && shown.length === 0 && (
        <p className="text-sm text-foreground/60">No teams match.</p>
      )}
      <div>
        <Button type="button" variant="text-quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function MergeConfirm({
  teamId,
  otherTeamId,
  onBack,
}: {
  teamId: number;
  otherTeamId: number;
  onBack: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [chosenName, setChosenName] = useState<string | null>(null);

  const pairQuery = useQuery({
    queryKey: queryKeys.teams.mergePair(teamId, otherTeamId),
    queryFn: ({ signal }) => fetchMergePair(teamId, otherTeamId, signal),
    retry: false,
  });
  const mergeMutation = useMutation({
    mutationFn: (name: string) => mergeTeams(teamId, { otherTeamId, name }),
    onSuccess: async ({ keptTeamId }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      router.push(`/teams/${keptTeamId}`);
    },
  });

  const pair = pairQuery.data;
  const error =
    apiErrorMessage(mergeMutation.error, TeamsApiError, 'Could not merge') ??
    apiErrorMessage(
      pairQuery.error,
      TeamsApiError,
      'Could not preview the merge',
    );

  if (!pair) {
    return (
      <>
        {error ? (
          <p role="alert" className="font-extrabold text-magenta">
            {error}
          </p>
        ) : (
          <p>Loading…</p>
        )}
        <div>
          <Button type="button" variant="text-quiet" onClick={onBack}>
            Back
          </Button>
        </div>
      </>
    );
  }

  const name = chosenName ?? pair.teams[0].name;
  return (
    <>
      <ul className="flex flex-col gap-1 text-sm">
        {pair.teams.map((team) => (
          <li key={team.id}>
            <span className="font-bold">{team.name}</span>:{' '}
            {team.sessionsPlayed} sessions played
          </li>
        ))}
      </ul>
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-bold">Name of the merged team</legend>
        {pair.teams.map((team) => (
          <label key={team.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="merged-team-name"
              checked={name === team.name}
              onChange={() => setChosenName(team.name)}
            />
            {team.name}
          </label>
        ))}
      </fieldset>
      <p className="text-sm">
        Code and phones carry over from{' '}
        <span className="font-bold">{pair.newerTeamName}</span>. The merged team
        will have {pair.combinedSessionsPlayed} sessions played. Its team code
        is <span className="font-mono font-bold">{pair.keptCode}</span>.
      </p>
      <p className="text-sm font-extrabold text-magenta">
        This can&apos;t be undone.
      </p>
      {error && (
        <p role="alert" className="font-extrabold text-magenta">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="solid-flat"
          size="sm"
          disabled={mergeMutation.isPending}
          onClick={() => mergeMutation.mutate(name)}
        >
          Merge teams
        </Button>
        <Button type="button" variant="text-quiet" onClick={onBack}>
          Back
        </Button>
      </div>
    </>
  );
}
