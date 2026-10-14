'use client';

import type { ActiveShowdownView } from '@campus-pubquiz/types';
import { ShowdownRevealScreen } from '@/app/components/showdown-reveal-screen';
import { displaySounds } from '@/app/lib/display-sounds';
import { useOnLiveForwardMove } from '@/app/lib/live-change';

interface DisplayShowdownProps {
  activeShowdown: ActiveShowdownView;
  step: number;
  /** Whether the display's connection is live; sounds stay silent otherwise. */
  isConnected: boolean;
}

/**
 * The big screen's showdown: the shared reveal plus its sounds. Each guess
 * slams in with a sound, the final step (the answer and the winner) bursts.
 * Sounds fire only on a live forward step: silent on a reload, a reconnect
 * and on Previous. Mounted only while the showdown is on air, so the first
 * step it sees is always the silent one.
 */
export function DisplayShowdown({
  activeShowdown,
  step,
  isConnected,
}: DisplayShowdownProps) {
  useOnLiveForwardMove(step, isConnected, () =>
    displaySounds.play(activeShowdown.answer === undefined ? 'slam' : 'burst'),
  );
  return <ShowdownRevealScreen activeShowdown={activeShowdown} step={step} />;
}
