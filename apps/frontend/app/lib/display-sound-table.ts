import type { DisplayScreen } from '@campus-pubquiz/types';
import type { DisplaySoundName } from '@/app/lib/display-sounds';

type ScreenKind = DisplayScreen['kind'];

const COUNTDOWN_KINDS: readonly ScreenKind[] = ['question', 'locking'];

/** The screens the quiz can be on once the block has locked. */
const AFTER_LOCK_KINDS: readonly ScreenKind[] = [
  'break_intro',
  'break_review',
  'break_round_title',
  'reveal_intro',
  'reveal',
];

/**
 * The one-off sound for a live forward move from one Display screen to the
 * next, or null when the move is silent. It only ever runs for a forward move
 * (the Screen position grew on a connected display), so it holds no ordering.
 */
export function soundFor(
  previous: DisplayScreen,
  next: DisplayScreen,
): DisplaySoundName | null {
  if (next.kind === 'round_title') return 'sting';
  if (next.kind === 'ended') return 'fanfare';
  if (
    COUNTDOWN_KINDS.includes(previous.kind) &&
    AFTER_LOCK_KINDS.includes(next.kind)
  ) {
    return 'timeUp';
  }
  if (next.kind === 'reveal') return 'reveal';
  return null;
}
