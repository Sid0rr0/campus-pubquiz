import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PresenterContextPayload } from '@campus-pubquiz/types';
import type { UseAuthResult } from '@/app/lib/use-auth';
import RemotePage from '@/app/remote/page';

const { mockUseAdminGame, mockUseAuth, searchParamsRef, routerRef } =
  vi.hoisted(() => ({
    mockUseAdminGame: vi.fn(),
    mockUseAuth: vi.fn(),
    searchParamsRef: { current: new URLSearchParams('code=ABCDEF') },
    routerRef: { push: vi.fn(), replace: vi.fn() },
  }));

vi.mock('@/app/lib/use-admin-game', async () => {
  const { adminGameResult } =
    await import('@/app/control/__tests__/test-utils');
  return {
    useAdminGame: (...args: unknown[]) =>
      adminGameResult(mockUseAdminGame(...args)),
  };
});

vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

function authenticatedAuthResult(
  overrides: Partial<UseAuthResult> = {},
): UseAuthResult {
  return {
    user: { id: 1, username: 'test-admin', role: 'admin', status: 'active' },
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function presenterContext(
  overrides: Partial<PresenterContextPayload> = {},
): PresenterContextPayload {
  return {
    currentQuestionNotes: null,
    currentRoundNote: null,
    currentScreen: { heading: 'R1 Q1' },
    nextScreen: null,
    ...overrides,
  };
}

describe('RemotePage — content', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockUseAdminGame.mockReset();
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
  });

  it('wires the Advance button to sendAction', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /advance/i }));

    expect(sendAction).toHaveBeenCalledWith('ADVANCE');
  });

  it.each([
    ['reveal_next_rank', 0, /show next team/i],
    ['hide_leaderboard', 1, /hide leaderboard/i],
  ] as const)(
    'labels the Advance slot from the announced %s step and sends ADVANCE',
    (_step, leaderboardRevealCount, label) => {
      const sendAction = vi.fn();
      mockUseAdminGame.mockReturnValue({
        session: {
          progress: { status: 'question_open', isLeaderboardVisible: true },
          leaderboard: [{ teamName: 'The Quizzards', totalPoints: 3 }],
          leaderboardRevealCount,
        },
        connectionError: null,
        sendAction,
        presenterContext: null,
      });
      renderWithQuery(<RemotePage />);

      fireEvent.click(screen.getByRole('button', { name: label }));

      expect(sendAction).toHaveBeenCalledTimes(1);
      expect(sendAction).toHaveBeenCalledWith('ADVANCE');
    },
  );

  it('hides the Advance slot when the announced step is none', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'ended' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /advance|next team|hide/i }),
    ).not.toBeInTheDocument();
  });

  it('greys Previous out while the leaderboard covers the screen and hides it when unavailable', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open', isLeaderboardVisible: true },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    const { unmount } = renderWithQuery(<RemotePage />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    unmount();

    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'lobby' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);
    expect(
      screen.queryByRole('button', { name: /previous/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps a rejected Advance out of the connection banner', async () => {
    // The admin hook toasts the rejection itself; the page only ever shows
    // real connection problems in its banner.
    const sendAction = vi.fn(() =>
      Promise.resolve({ success: false as const, error: 'Cannot advance' }),
    );
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /advance/i }));

    await waitFor(() => expect(sendAction).toHaveBeenCalledWith('ADVANCE'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('wires the Previous button to sendAction', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
      },
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));

    expect(sendAction).toHaveBeenCalledWith('PREVIOUS');
  });

  it('shows the current question notes when present', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        currentQuestionNotes: 'Remind teams: EU capitals only.',
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.getByText('Remind teams: EU capitals only.'),
    ).toBeInTheDocument();
  });

  it('shows the notes of the question being revealed', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'reveal' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        currentQuestionNotes: 'Accept "Abba".',
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Accept "Abba".')).toBeInTheDocument();
  });

  it('shows an empty state when there are no notes', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext(),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('No notes for this question.')).toBeInTheDocument();
  });

  it.each(['round_intro', 'break_round_intro', 'reveal_intro'] as const)(
    'shows the round note on a %s',
    (status) => {
      mockUseAdminGame.mockReturnValue({
        session: { progress: { status } },
        connectionError: null,
        sendAction: vi.fn(),
        presenterContext: presenterContext({
          currentRoundNote: 'Answers must be in English.',
        }),
      });
      renderWithQuery(<RemotePage />);

      expect(
        screen.getByText('Answers must be in English.'),
      ).toBeInTheDocument();
    },
  );

  it('says there is no note for a round intro without one', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'round_intro' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({ currentRoundNote: null }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('No note for this round.')).toBeInTheDocument();
    expect(
      screen.queryByText('No notes for this question.'),
    ).not.toBeInTheDocument();
  });

  it('shows what the display is currently showing', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        currentScreen: { heading: 'Break 1', body: 'After round 2' },
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Break 1')).toBeInTheDocument();
    expect(screen.getByText('After round 2')).toBeInTheDocument();
  });

  it('previews the next screen', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        nextScreen: {
          heading: 'Revealing · Round 1 title',
          body: 'Geography',
        },
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Revealing · Round 1 title')).toBeInTheDocument();
    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.queryByText('Nothing queued yet.')).not.toBeInTheDocument();
  });

  it('shows the full question preview when the next screen is a question', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext({
        nextScreen: {
          heading: 'R1 Q2',
          question: {
            id: 22,
            type: 'free_text',
            prompt: 'Name the largest planet in the solar system.',
            points: 2,
            answer: 'Jupiter',
          },
        },
      }),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('R1 Q2')).toBeInTheDocument();
    expect(
      screen.getByText('Name the largest planet in the solar system.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is queued next', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: presenterContext(),
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('Nothing queued yet.')).toBeInTheDocument();
  });

  it('shows how many teams have answered while a question is open', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
          { teamId: 3, teamName: 'Quiz Pistols' },
        ],
        answeredTeams: { 1: [1, 2] },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText('2/3 teams answered')).toBeInTheDocument();
  });

  it('shows how many teams answered correctly once graded', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [
          {
            questions: [
              {
                id: 55,
                type: 'multiple_choice',
                prompt: 'Capital of France?',
                options: ['Paris', 'London'],
              },
            ],
          },
        ],
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
        answeredTeams: { 55: [1, 2] },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: {
        questionId: 55,
        question: {
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          points: 2,
          correctAnswer: 'Paris',
          roundTitle: 'Geography',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 1,
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Paris',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'London',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'incorrect',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/1 correct/i)).toBeInTheDocument();
  });

  it('counts a speed-scaled kahoot answer with fewer than full points as correct', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [
          {
            questions: [
              {
                id: 55,
                type: 'multiple_choice',
                prompt: 'Capital of France?',
                options: ['Paris', 'London'],
              },
            ],
          },
        ],
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
        answeredTeams: { 55: [1, 2] },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: {
        questionId: 55,
        question: {
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          points: 1000,
          correctAnswer: 'Paris',
          roundTitle: 'Speed Round',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 1,
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Paris',
            pointsAwarded: 870,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'Paris',
            pointsAwarded: 520,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/2 correct/i)).toBeInTheDocument();
  });

  it('keeps showing the correct count once grading moves the question into break', () => {
    // The count is most useful once the admin is actually grading in
    // /control, which happens during 'break' — after the question has
    // closed and answeredTeamIds/currentQuestion have already cleared. It
    // must not be tied to showAnswerStatus the way the teams-answered line
    // is, or it disappears exactly when it becomes meaningful.
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'break' },
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: {
        questionId: 55,
        question: {
          type: 'free_text',
          prompt: 'Capital of France?',
          points: 2,
          correctAnswer: 'Paris',
          roundTitle: 'Geography',
          roundNumber: 1,
          questionNumberInRound: 1,
          totalQuestionsInRound: 1,
        },
        answers: [
          {
            answerId: 1,
            teamId: 1,
            teamName: 'The Quizzards',
            value: 'Paris',
            pointsAwarded: 2,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'correct',
          },
          {
            answerId: 2,
            teamId: 2,
            teamName: 'Beer Necessities',
            value: 'London',
            pointsAwarded: 0,
            gradedAt: '2026-01-01T00:00:00.000Z',
            verdict: 'incorrect',
          },
        ],
      },
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByText(/1 correct/i)).toBeInTheDocument();
  });

  it('omits the correct count when nothing has been submitted or graded yet', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [
          {
            questions: [
              {
                id: 55,
                type: 'multiple_choice',
                prompt: 'Capital of France?',
                options: ['Paris', 'London'],
              },
            ],
          },
        ],
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
      liveAnswers: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
  });

  it('hides the answered count once the question is no longer open', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'break' },
        teams: [{ teamId: 1, teamName: 'The Quizzards' }],
        answeredTeams: { 1: [1] },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.queryByText(/teams answered/i)).not.toBeInTheDocument();
  });

  it('shows the elapsed time while a question/break is live', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        phaseTimer: { startedAt: Date.now() - 5_000 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('0:05');
  });

  it('shows the final elapsed time once the phase is no longer live', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        phaseTimer: { elapsedMs: 125_000 },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.getByTestId('phase-timer')).toHaveTextContent('2:05');
  });

  it('shows no elapsed time for an untimed status', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'reveal' },
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(screen.queryByTestId('phase-timer')).not.toBeInTheDocument();
  });

  it('shows a Play Again button for an open YouTube question and dispatches REPLAY_MEDIA', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [
          {
            questions: [
              {
                id: 55,
                type: 'free_text',
                prompt: 'Name this music video.',
                mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
              },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /play video again/i }));

    expect(sendAction).toHaveBeenCalledWith('REPLAY_MEDIA');
  });

  it.each([
    [2, false],
    [3, true],
  ])(
    'at closest_guess reveal step %i offers Play Again and Pause: %s',
    (closestGuessRevealStep, isOffered) => {
      mockUseAdminGame.mockReturnValue({
        session: {
          progress: { status: 'reveal' },
          closestGuessRevealStep,
          rounds: [
            {
              questions: [
                {
                  id: 55,
                  type: 'closest_guess',
                  prompt: 'How many?',
                  answer: '10',
                  answerMediaUrl: 'https://example.com/answer.mp4',
                  closestGuess: {
                    hasSubmissions: true,
                    minGuess: '5',
                    maxGuess: '20',
                    closestGuesses: [{ teamName: 'Team A', value: '9' }],
                  },
                },
              ],
            },
          ],
        },
        connectionError: null,
        sendAction: vi.fn(),
        presenterContext: null,
      });
      renderWithQuery(<RemotePage />);

      expect(
        screen.queryByRole('button', { name: /play video again/i }) !== null,
      ).toBe(isOffered);
      expect(screen.queryByRole('button', { name: 'Pause' }) !== null).toBe(
        isOffered,
      );
    },
  );

  function mockOpenQuestionWithMedia(
    mediaUrl: string,
    sendAction = vi.fn(),
    isMediaPaused?: boolean,
  ) {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open', isMediaPaused },
        rounds: [
          {
            questions: [
              { id: 55, type: 'free_text', prompt: 'Name it.', mediaUrl },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
  }

  it('shows a Pause button for audio and dispatches TOGGLE_MEDIA_PAUSE', () => {
    const sendAction = vi.fn();
    mockOpenQuestionWithMedia('https://example.com/song.mp3', sendAction);
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_PAUSE');
    expect(
      screen.queryByRole('button', { name: /play video again/i }),
    ).not.toBeInTheDocument();
  });

  it('shows Resume while the media is paused', () => {
    mockOpenQuestionWithMedia('https://youtu.be/dQw4w9WgXcQ', vi.fn(), true);
    renderWithQuery(<RemotePage />);

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('names the Space key in the Pause button tooltip', () => {
    mockOpenQuestionWithMedia('https://example.com/song.mp3');
    renderWithQuery(<RemotePage />);

    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute(
      'title',
      expect.stringContaining('Space'),
    );
  });

  it('sends TOGGLE_MEDIA_PAUSE on Space while the Pause button is shown', () => {
    const sendAction = vi.fn();
    mockOpenQuestionWithMedia('https://example.com/song.mp3', sendAction);
    renderWithQuery(<RemotePage />);

    fireEvent.keyDown(window, { key: ' ' });

    expect(sendAction).toHaveBeenCalledTimes(1);
    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_PAUSE');
  });

  it('leaves Space to the browser when no Pause button is shown', () => {
    const sendAction = vi.fn();
    mockOpenQuestionWithMedia('https://example.com/photo.jpg', sendAction);
    renderWithQuery(<RemotePage />);

    const notPrevented = fireEvent.keyDown(window, { key: ' ' });

    expect(sendAction).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it('gives /remote no shortcuts other than Space', () => {
    const sendAction = vi.fn();
    mockOpenQuestionWithMedia('https://example.com/song.mp3', sendAction);
    renderWithQuery(<RemotePage />);

    for (const key of ['f', 'm', 'j', 'ArrowRight', 'ArrowLeft']) {
      fireEvent.keyDown(window, { key });
    }

    expect(sendAction).not.toHaveBeenCalled();
  });

  it('ignores Space typed in a form field', () => {
    const sendAction = vi.fn();
    mockOpenQuestionWithMedia('https://example.com/song.mp3', sendAction);
    renderWithQuery(<RemotePage />);
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: ' ' });

    expect(sendAction).not.toHaveBeenCalled();
    input.remove();
  });

  it('shows Pause and Play again at reveal for an answer video, and Space pauses it', () => {
    const sendAction = vi.fn();
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'reveal', revealIndex: 0 },
        rounds: [
          {
            questions: [
              {
                id: 55,
                type: 'free_text',
                prompt: 'Name it.',
                answer: 'Alien',
                answerMediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
              },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction,
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    fireEvent.click(screen.getByRole('button', { name: /play video again/i }));
    fireEvent.keyDown(window, { key: ' ' });

    expect(sendAction).toHaveBeenCalledWith('REPLAY_MEDIA');
    expect(sendAction).toHaveBeenCalledWith('TOGGLE_MEDIA_PAUSE');
  });

  it('hides the Pause button for an image question', () => {
    mockOpenQuestionWithMedia('https://example.com/photo.jpg');
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /^(pause|resume)$/i }),
    ).not.toBeInTheDocument();
  });

  it('hides the Play Again button for a non-YouTube question', () => {
    mockUseAdminGame.mockReturnValue({
      session: {
        progress: { status: 'question_open' },
        rounds: [
          {
            questions: [
              {
                id: 55,
                type: 'multiple_choice',
                prompt: 'Capital of France?',
                options: ['Paris', 'London'],
              },
            ],
          },
        ],
      },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /play video again/i }),
    ).not.toBeInTheDocument();
  });

  it('renders no grading, team, or leaderboard controls', () => {
    mockUseAdminGame.mockReturnValue({
      session: { progress: { status: 'question_open' } },
      connectionError: null,
      sendAction: vi.fn(),
      presenterContext: null,
    });
    renderWithQuery(<RemotePage />);

    expect(
      screen.queryByRole('button', { name: /grade/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /kick/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /leaderboard/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/leaderboard/i)).not.toBeInTheDocument();
  });
});
