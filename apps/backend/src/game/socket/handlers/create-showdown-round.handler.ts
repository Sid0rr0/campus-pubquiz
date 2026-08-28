import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import {
  getTiedForFirst,
  type CreateShowdownRoundPayload,
} from '@campus-pubquiz/types';
import { broadcastGameState } from '@/game/socket/game-broadcast.util';
import type { GameStateService } from '@/game/state/game-state.service';
import type { ActiveShowdownRoundState } from '@/game/state/session-state';
import {
  InvalidShowdownError,
  ShowdownService,
} from '@/showdown/showdown.service';

export async function createShowdownRound(
  deps: {
    gameState: GameStateService;
    showdownService: ShowdownService;
    server: Server;
  },
  joinCode: string,
  payload: CreateShowdownRoundPayload,
): Promise<void> {
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

  deps.gameState.setActiveShowdownRound(joinCode, round);
  // Leaves isLeaderboardVisible untouched — the admin's own "Hide
  // Leaderboard" press (already wired into NavigationButtons' Advance
  // button whenever the leaderboard is up) is what clears it before the
  // showdown reveal starts, the same way it clears between any other block
  // and the next. Forcing it false here would yank the final standings off
  // the display the instant the tiebreaker question is saved, even though
  // it can now be created mid-break, well before anyone's seen them.
  broadcastGameState(
    deps.server,
    joinCode,
    deps.gameState.getSnapshot(joinCode),
  );
}
