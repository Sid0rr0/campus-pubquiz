import { WsException } from '@nestjs/websockets';
import {
  getTiedForFirst,
  type CreateShowdownRoundPayload,
} from '@campus-pubquiz/types';
import type { ActiveShowdownRoundState } from '@/game/state/session-state';
import { InvalidShowdownError } from '@/showdown/showdown.service';
import type { EventServices } from '@/game/socket/handlers/event-services';
import type {
  EventContext,
  EventResult,
} from '@/game/socket/guarded-dispatch.util';

export async function createShowdownRound(
  deps: EventServices,
  { joinCode, payload }: EventContext<CreateShowdownRoundPayload>,
): Promise<EventResult> {
  const snapshot = deps.gameState.getSnapshot(joinCode);
  // Re-derives the tied teams server-side rather than trusting a
  // client-supplied list — same reasoning as every other admin-action
  // validation in this codebase. Also doubles as the createRound() call's
  // participant list, in leaderboard (seatIndex) order.
  const tied = getTiedForFirst(snapshot.leaderboard);
  if (tied.length < 2) {
    throw new WsException('No tie for first place to break');
  }

  let round: ActiveShowdownRoundState;
  try {
    round = await deps.showdownService.createRound(
      deps.gameState.getGameSessionId(joinCode),
      tied.map((entry) => ({ teamId: entry.teamId, teamName: entry.teamName })),
      payload.question,
      payload.answer,
      payload.points,
    );
  } catch (error) {
    if (error instanceof InvalidShowdownError) {
      throw new WsException(error.message);
    }
    throw error;
  }

  // Leaves isLeaderboardVisible untouched — the admin's own "Hide
  // Leaderboard" press (already wired into NavigationButtons' Advance
  // button whenever the leaderboard is up) is what clears it before the
  // showdown reveal starts, the same way it clears between any other block
  // and the next. Forcing it false here would yank the final standings off
  // the display the instant the tiebreaker question is saved, even though
  // it can now be created mid-break, well before anyone's seen them.
  return deps.gameState.showdownRoundCreated(joinCode, round);
}
