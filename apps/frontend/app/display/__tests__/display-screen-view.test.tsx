import { cloneElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import {
  DisplayScreenView,
  type DisplayLiveContext,
} from '@/app/components/display-screen-view';
import { roomView, type SessionDescription } from '@/test-utils/room-view';

const TEAMS = [
  { teamId: 1, teamName: 'The Quizzards' },
  { teamId: 2, teamName: 'Second Place' },
];

const TWO_ROUNDS = [
  { title: 'General Knowledge', questions: [{ prompt: 'Capital of France?' }] },
  { title: 'Science', questions: [{ prompt: 'Largest planet?' }] },
];

/** Draws the on-air screen of the described session with no live context. */
function drawWithoutLiveContext(description: SessionDescription) {
  const view = roomView(SOCKET_ROOMS.DISPLAY, {
    teams: TEAMS,
    ...description,
  });
  return render(
    <DisplayScreenView
      screen={view.screen}
      quiz={{
        settings: view.settings,
        quizStructure: view.quizStructure,
        roundTitles: view.roundTitles,
        roundCategories: view.roundCategories,
        roundAuthors: view.roundAuthors,
      }}
    />,
  );
}

function expectNoLiveParts() {
  expect(screen.queryByText(/TEAMS ANSWERED/)).not.toBeInTheDocument();
  expect(screen.queryByTestId('teams-correct')).not.toBeInTheDocument();
  expect(screen.queryByText('The Quizzards')).not.toBeInTheDocument();
  expect(screen.queryByText(/fun fact/i)).not.toBeInTheDocument();
}

describe('DisplayScreenView — without a live context', () => {
  it('draws the round overview', () => {
    drawWithoutLiveContext({
      rounds: TWO_ROUNDS,
      progress: { status: 'round_overview' },
    });

    expect(screen.getByText('General Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Science')).toBeInTheDocument();
    expectNoLiveParts();
  });

  it('draws the round title', () => {
    drawWithoutLiveContext({
      rounds: TWO_ROUNDS,
      progress: { status: 'round_intro', roundIndex: 1 },
    });

    expect(screen.getByText('Science')).toBeInTheDocument();
    expectNoLiveParts();
  });

  it('draws an open question and keeps the answered count line in place, empty', () => {
    const { container } = drawWithoutLiveContext({
      rounds: TWO_ROUNDS,
      progress: { status: 'question_open' },
    });

    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expectNoLiveParts();
    expect(container.querySelector('p[aria-hidden="true"]')).not.toBeNull();
  });

  it('draws the break intro without fun facts', () => {
    drawWithoutLiveContext({
      rounds: [{ breakAfter: false, questions: [{}] }, { questions: [{}] }],
      progress: { status: 'break_intro', roundIndex: 1 },
    });

    expect(screen.getByText('BREAK 1')).toBeInTheDocument();
    expectNoLiveParts();
  });

  it('draws the reveal intro', () => {
    drawWithoutLiveContext({
      rounds: TWO_ROUNDS,
      progress: {
        status: 'reveal_intro',
        roundIndex: 0,
        questionIndex: 0,
        revealIndex: 0,
      },
    });

    expect(screen.getByText(/REVEALING ANSWERS/)).toBeInTheDocument();
    expectNoLiveParts();
  });

  it('draws a revealed answer without the teams-correct count', () => {
    drawWithoutLiveContext({
      rounds: [
        {
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
          ],
        },
      ],
      progress: { status: 'reveal', revealIndex: 0 },
      answerVerdicts: { 1: ['correct', 'correct'] },
    });

    expect(screen.getByText('Largest planet?')).toBeInTheDocument();
    expect(screen.getAllByText('Jupiter').length).toBeGreaterThan(0);
    expectNoLiveParts();
  });

  describe('answer media at reveal', () => {
    const LIVE = {
      teams: [],
      answeredTeamIds: [],
      leaderboard: [],
      leagueTop: null,
      teamsCorrect: null,
      joinCode: 'ABCDEF',
      isConnected: true,
      kahootQuestionEndsAt: null,
      onPickAnotherGame: () => undefined,
      onWinnerCelebrated: () => undefined,
    };

    function drawReveal(live: Partial<DisplayLiveContext>) {
      const view = roomView(SOCKET_ROOMS.DISPLAY, {
        teams: TEAMS,
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Name this film.',
                answer: 'Alien',
                answerMediaUrl: 'https://example.com/answer.webm',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      });
      const element = (
        <DisplayScreenView
          screen={view.screen}
          quiz={{
            settings: view.settings,
            quizStructure: view.quizStructure,
            roundTitles: view.roundTitles,
            roundCategories: view.roundCategories,
            roundAuthors: view.roundAuthors,
          }}
          live={{ ...LIVE, ...live }}
        />
      );
      return { element, ...render(element) };
    }

    it('pauses and resumes the answer video in place', () => {
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => undefined);
      const play = vi
        .spyOn(HTMLMediaElement.prototype, 'play')
        .mockResolvedValue(undefined);
      const { rerender, element } = drawReveal({ isMediaPaused: false });
      const video = screen.getByTestId('reveal-answer-video');

      rerender(
        cloneElement(element, { live: { ...LIVE, isMediaPaused: true } }),
      );
      expect(pause).toHaveBeenCalledTimes(1);

      rerender(
        cloneElement(element, { live: { ...LIVE, isMediaPaused: false } }),
      );
      expect(play).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('reveal-answer-video')).toBe(video);
      vi.restoreAllMocks();
    });

    it('plays the answer video again on REPLAY_MEDIA', () => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { rerender, element } = drawReveal({ mediaReplayToken: 0 });
      const video = screen.getByTestId(
        'reveal-answer-video',
      ) as HTMLVideoElement;
      video.currentTime = 12;

      rerender(
        cloneElement(element, { live: { ...LIVE, mediaReplayToken: 1 } }),
      );

      expect(video.currentTime).toBe(0);
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  it('draws a closest-guess reveal', () => {
    drawWithoutLiveContext({
      rounds: [
        {
          questions: [
            {
              type: 'closest_guess',
              prompt: 'How tall is the tower?',
              points: 5,
              answer: '55',
              closestGuess: {
                hasSubmissions: true,
                minGuess: '10',
                maxGuess: '90',
                closestGuesses: [{ teamName: 'Team A', value: '50' }],
              },
            },
          ],
        },
      ],
      progress: { status: 'reveal', revealIndex: 0 },
      closestGuessRevealStep: 2,
    });

    expect(screen.getByText('How tall is the tower?')).toBeInTheDocument();
    expectNoLiveParts();
  });
});
