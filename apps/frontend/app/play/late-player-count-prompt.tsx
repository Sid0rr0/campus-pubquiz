'use client';

import { useState } from 'react';
import type { AckResult } from '@campus-pubquiz/types';
import {
  readPlayerCountPromptDecision,
  readPlayerCountPromptDismissed,
  writePlayerCountPromptDecision,
  writePlayerCountPromptDismissed,
} from '@/app/lib/player-count-prompt-storage';
import { PlayerCountCard } from '@/app/play/player-count-card';

interface LatePlayerCountPromptProps {
  joinCode: string;
  /** Whether the server has accepted this phone's join, so its saved count (or lack of one) is known. */
  hasJoined: boolean;
  /** Whether the phone is on the lobby screen, which carries its own card. */
  isLobby: boolean;
  savedCount: number | null;
  onSend: (playerCount: number) => Promise<AckResult>;
}

/**
 * The player count card for a team that joined after the lobby without a
 * count: asked once, over whatever screen it landed on, with a dismiss that
 * this phone remembers. Whether to ask is decided once per session, when the
 * join first lands, and remembered on this phone, so a reconnect with a count
 * never asks, a lobby joiner is not asked after a mid-quiz reload, and a saved
 * count folds the card instead of removing it.
 */
export function LatePlayerCountPrompt({
  joinCode,
  hasJoined,
  isLobby,
  savedCount,
  onSend,
}: LatePlayerCountPromptProps) {
  const [shouldAsk, setShouldAsk] = useState<boolean | null>(() =>
    readPlayerCountPromptDecision(joinCode),
  );
  const [isDismissed, setIsDismissed] = useState(() =>
    readPlayerCountPromptDismissed(joinCode),
  );
  if (shouldAsk === null && hasJoined) {
    const decision = !isLobby && savedCount === null;
    writePlayerCountPromptDecision(joinCode, decision);
    setShouldAsk(decision);
  }
  if (!shouldAsk || isDismissed) return null;

  return (
    <div className="mb-4">
      <PlayerCountCard
        savedCount={savedCount}
        onSend={onSend}
        onDismiss={() => {
          writePlayerCountPromptDismissed(joinCode);
          setIsDismissed(true);
        }}
      />
    </div>
  );
}
