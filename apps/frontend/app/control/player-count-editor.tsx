'use client';

import { useState, type FormEvent } from 'react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import {
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  type AdminTeamView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

interface PlayerCountEditorProps {
  team: AdminTeamView;
  onSetPlayerCount: (teamId: number, playerCount: number) => void;
}

/** The count typed, or null when it is not a whole number the server would accept. */
function parseDraft(draft: string): number | null {
  const count = Number(draft);
  const isValid =
    draft.trim() !== '' &&
    Number.isInteger(count) &&
    count >= MIN_PLAYER_COUNT &&
    count <= MAX_PLAYER_COUNT;
  return isValid ? count : null;
}

/** One team's player count in the Teams panel, with the over-cap flag and a small editor to set or correct it. */
export function PlayerCountEditor({
  team,
  onSetPlayerCount,
}: PlayerCountEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const parsed = parseDraft(draft);

  const startEditing = () => {
    setDraft(team.playerCount === null ? '' : String(team.playerCount));
    setIsEditing(true);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (parsed === null) return;
    onSetPlayerCount(team.teamId, parsed);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-bold text-background/70">
        <span>Players:</span>
        <span className={team.isOverPlayerCap ? 'text-magenta' : undefined}>
          {team.playerCount ?? '—'}
        </span>
        {team.isOverPlayerCap && (
          <span className="text-magenta">Over the player cap</span>
        )}
        <Button
          type="button"
          aria-label={`Edit player count for ${team.teamName}`}
          className="ml-auto flex items-center gap-1 underline"
          onClick={startEditing}
        >
          <Pencil1Icon aria-hidden="true" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      className="flex items-center gap-1.5 text-xs font-bold"
    >
      <input
        type="number"
        min={MIN_PLAYER_COUNT}
        max={MAX_PLAYER_COUNT}
        step={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={`Player count for ${team.teamName}`}
        className="w-16 rounded border border-background/30 bg-transparent px-1.5 py-0.5"
      />
      <Button
        type="submit"
        disabled={parsed === null}
        className="underline disabled:opacity-40"
      >
        Save
      </Button>
      <Button
        type="button"
        className="underline"
        onClick={() => setIsEditing(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
