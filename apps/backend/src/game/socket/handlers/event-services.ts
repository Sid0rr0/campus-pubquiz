import type { Server } from 'socket.io';
import type { AnswerService } from '@/answer/answer.service';
import type { BonusService } from '@/bonus/bonus.service';
import type { FeedbackService } from '@/feedback/feedback.service';
import type { GameStateService } from '@/game/state/game-state.service';
import type { ShowdownService } from '@/showdown/showdown.service';
import type { TeamService } from '@/team/team.service';

/** The gateway's injected services, handed to every event body that needs them. */
export interface EventServices {
  gameState: GameStateService;
  teamService: TeamService;
  answerService: AnswerService;
  bonusService: BonusService;
  feedbackService: FeedbackService;
  showdownService: ShowdownService;
  server: Server;
}
