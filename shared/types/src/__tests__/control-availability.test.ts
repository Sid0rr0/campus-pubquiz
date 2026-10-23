import { describe, expect, it } from 'vitest';
import {
  describeControlAvailability,
  describeMediaControls,
} from '../control-availability';
import type { DisplayScreen } from '../display-screen';
import type { GameStatus } from '../game-state';
import type { QuestionView } from '../question-views';
import type { LeaderboardEntry } from '../room-views';
import { lobby } from './game-state-fixtures';

const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIDEO_FILE = 'https://example.com/clip.mp4';
const AUDIO_FILE = 'https://example.com/song.mp3';
const IMAGE = 'https://example.com/photo.png';

function entry(
  teamId: number,
  teamName: string,
  totalPoints: number,
  rank: number,
): LeaderboardEntry {
  return {
    teamId,
    teamName,
    totalPoints,
    rank,
    rankTo: rank,
    bonusPoints: 0,
    positiveBonusPoints: 0,
    negativeBonusPoints: 0,
    roundPoints: [],
  };
}

function questionScreen(mediaUrl: string | undefined): DisplayScreen {
  return {
    kind: 'question',
    question: { mediaUrl } as unknown as QuestionView,
  };
}

function availabilityFor(
  status: GameStatus,
  overrides: {
    leaderboard?: LeaderboardEntry[];
    displayScreen?: DisplayScreen;
  } = {},
) {
  return describeControlAvailability({
    progress: { ...lobby, status },
    leaderboard: overrides.leaderboard ?? [],
    displayScreen: overrides.displayScreen ?? { kind: 'blank' },
  });
}

describe('describeMediaControls', () => {
  it('allows replay and pause for a YouTube link', () => {
    expect(describeMediaControls(YOUTUBE)).toEqual({
      canReplayMedia: true,
      canPauseMedia: true,
    });
  });

  it('allows replay and pause for a video file', () => {
    expect(describeMediaControls(VIDEO_FILE)).toEqual({
      canReplayMedia: true,
      canPauseMedia: true,
    });
  });

  it('allows pause but not replay for audio', () => {
    expect(describeMediaControls(AUDIO_FILE)).toEqual({
      canReplayMedia: false,
      canPauseMedia: true,
    });
  });

  it('allows neither for an image', () => {
    expect(describeMediaControls(IMAGE)).toEqual({
      canReplayMedia: false,
      canPauseMedia: false,
    });
  });

  it('allows neither when nothing is playing', () => {
    expect(describeMediaControls(undefined)).toEqual({
      canReplayMedia: false,
      canPauseMedia: false,
    });
  });
});

describe('describeControlAvailability', () => {
  it('lets the quiz master start only from the lobby', () => {
    expect(availabilityFor('lobby').canStartQuiz).toBe(true);
    expect(availabilityFor('question_open').canStartQuiz).toBe(false);
    expect(availabilityFor('ended').canStartQuiz).toBe(false);
  });

  it('lets the quiz master end the quiz until it has ended', () => {
    expect(availabilityFor('lobby').canEndQuiz).toBe(true);
    expect(availabilityFor('question_open').canEndQuiz).toBe(true);
    expect(availabilityFor('ended').canEndQuiz).toBe(false);
  });

  it('lets the quiz master close the session only once the quiz has ended', () => {
    expect(availabilityFor('ended').canCloseSession).toBe(true);
    expect(availabilityFor('lobby').canCloseSession).toBe(false);
    expect(availabilityFor('question_open').canCloseSession).toBe(false);
  });

  it('offers the join overlay toggle neither in the lobby nor after the end', () => {
    expect(availabilityFor('lobby').canToggleJoinOverlay).toBe(false);
    expect(availabilityFor('ended').canToggleJoinOverlay).toBe(false);
    expect(availabilityFor('question_open').canToggleJoinOverlay).toBe(true);
  });

  it('shows the answer status only while a question is on air', () => {
    expect(availabilityFor('question_open').showAnswerStatus).toBe(true);
    expect(availabilityFor('locking').showAnswerStatus).toBe(true);
    expect(availabilityFor('lobby').showAnswerStatus).toBe(false);
    expect(availabilityFor('ended').showAnswerStatus).toBe(false);
  });

  it('reads the media buttons from the media the big screen is playing', () => {
    const availability = availabilityFor('question_open', {
      displayScreen: questionScreen(VIDEO_FILE),
    });

    expect(availability.canReplayMedia).toBe(true);
    expect(availability.canPauseMedia).toBe(true);
  });

  it('disables the media buttons on a screen that plays nothing', () => {
    const availability = availabilityFor('question_open', {
      displayScreen: questionScreen(undefined),
    });

    expect(availability.canReplayMedia).toBe(false);
    expect(availability.canPauseMedia).toBe(false);
  });

  it('names the teams tied for first, in leaderboard order', () => {
    const availability = availabilityFor('reveal', {
      leaderboard: [
        entry(1, 'Alpha', 20, 1),
        entry(2, 'Beta', 20, 1),
        entry(3, 'Gamma', 10, 3),
      ],
    });

    expect(availability.tiedTeamNames).toEqual(['Alpha', 'Beta']);
  });

  it('names nobody when there is an outright leader', () => {
    const availability = availabilityFor('reveal', {
      leaderboard: [entry(1, 'Alpha', 20, 1), entry(2, 'Beta', 10, 2)],
    });

    expect(availability.tiedTeamNames).toEqual([]);
  });
});
