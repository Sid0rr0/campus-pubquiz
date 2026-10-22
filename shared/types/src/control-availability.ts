import { getPlayingMediaUrl, type DisplayScreen } from './display-screen';
import {
  isJoinOverlayAllowedStatus,
  isQuestionOnAirStatus,
} from './game-state-groups';
import type { GameProgress } from './game-state-types';
import { getTiedForFirst } from './leaderboard-tiebreak';
import { isPausableMediaUrl, isVideoUrl } from './media';
import type { LeaderboardEntry } from './room-views';

/** What the quiz master can do right now, decided by the server for /control and /remote. */
export interface ControlAvailability {
  canStartQuiz: boolean;
  canEndQuiz: boolean;
  canCloseSession: boolean;
  /** Not in the lobby (it already shows the QR code) or once the quiz has ended. */
  canToggleJoinOverlay: boolean;
  /** The big screen is playing a video. */
  canReplayMedia: boolean;
  /** The big screen is playing a video or audio. */
  canPauseMedia: boolean;
  /** Whether the teams-answered status is shown: only while a question is on air. */
  showAnswerStatus: boolean;
  /** The teams tied for first, empty unless two or more are. */
  tiedTeamNames: string[];
}

export interface ControlAvailabilityInput {
  progress: GameProgress;
  leaderboard: LeaderboardEntry[];
  /** The Display screen /display is sent. */
  displayScreen: DisplayScreen;
}

export function describeControlAvailability({
  progress,
  leaderboard,
  displayScreen,
}: ControlAvailabilityInput): ControlAvailability {
  const { status } = progress;
  const playingMediaUrl = getPlayingMediaUrl(displayScreen);
  return {
    canStartQuiz: status === 'lobby',
    canEndQuiz: status !== 'ended',
    canCloseSession: status === 'ended',
    canToggleJoinOverlay: isJoinOverlayAllowedStatus(status),
    canReplayMedia: isVideoUrl(playingMediaUrl),
    canPauseMedia: isPausableMediaUrl(playingMediaUrl),
    showAnswerStatus: isQuestionOnAirStatus(status),
    tiedTeamNames: getTiedForFirst(leaderboard).map((entry) => entry.teamName),
  };
}
