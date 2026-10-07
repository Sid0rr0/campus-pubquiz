import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DisplayPage from '@/app/display/page';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { roomView } from '@/test-utils/room-view';

const { mockUseGame, searchParamsRef } = vi.hoisted(() => ({
  mockUseGame: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-display-game', () => ({
  useDisplayGame: mockUseGame,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg
      role="img"
      aria-label={title}
      data-testid="qr-code"
      data-value={value}
    />
  ),
}));

const capitalOfFrance = {
  type: 'multiple_choice' as const,
  prompt: 'Capital of France?',
  options: ['Paris', 'London'],
  points: 2,
};

describe('DisplayPage — question display', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the current question and its options while open', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [capitalOfFrance] }],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('London')).toBeInTheDocument();
  });

  it('shows sort items numbered in display order', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'sort',
                prompt: 'Order these planets from the sun outward.',
                options: ['Venus', 'Mercury', 'Earth'],
                points: 3,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(
      screen.getByText('Order these planets from the sun outward.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Venus')).toBeInTheDocument();
    expect(screen.getByText('Mercury')).toBeInTheDocument();
    expect(screen.getByText('Earth')).toBeInTheDocument();
  });

  it.each(['audio', 'youtube'] as const)(
    'shows the choices of a %s question that has some',
    (type) => {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          rounds: [
            {
              questions: [
                {
                  type,
                  prompt: 'Which song is this?',
                  mediaUrl: 'https://example.com/song.mp3',
                  options: ['Yesterday', 'Help!'],
                  points: 1,
                },
              ],
            },
          ],
          progress: { status: 'question_open' },
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
      render(<DisplayPage />);

      expect(screen.getByText('Yesterday')).toBeInTheDocument();
      expect(screen.getByText('Help!')).toBeInTheDocument();
    },
  );

  it('shows no choices for an audio question whose choices are all blank', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'audio',
                prompt: 'Which song is this?',
                mediaUrl: 'https://example.com/song.mp3',
                options: ['', '  '],
                points: 1,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('shows both match lists before reveal', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'match',
                prompt: 'Match the hero to their weapon.',
                options: ['arthur', 'captain america'],
                matchTargets: ['shield', 'excalibur'],
                points: 4,
              },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('arthur')).toBeInTheDocument();
    expect(screen.getByText('captain america')).toBeInTheDocument();
    expect(screen.getByText('shield')).toBeInTheDocument();
    expect(screen.getByText('excalibur')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('shows the question image in a fullscreen overlay when media fullscreen is on', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              { ...capitalOfFrance, mediaUrl: 'https://example.com/x.png' },
            ],
          },
        ],
        progress: {
          status: 'question_open',
          isMediaFullscreen: true,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('question-image').parentElement).toHaveClass(
      'fixed',
    );
  });

  it('does not show the image in a fullscreen overlay when media fullscreen is off', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              { ...capitalOfFrance, mediaUrl: 'https://example.com/x.png' },
            ],
          },
        ],
        progress: {
          status: 'question_open',
          isMediaFullscreen: false,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('question-image').parentElement).not.toHaveClass(
      'fixed',
    );
  });

  it('does not show any media when the question has none, even with fullscreen on', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [capitalOfFrance] }],
        progress: {
          status: 'question_open',
          isMediaFullscreen: true,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.queryByTestId('question-image')).not.toBeInTheDocument();
  });

  it('switches to a two-column layout once a portrait image loads', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              { ...capitalOfFrance, mediaUrl: 'https://example.com/x.png' },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const row = screen.getByTestId('question-prompt-media-row');
    expect(row).toHaveAttribute('data-layout', 'stacked');

    const image = screen.getByTestId('question-image');
    Object.defineProperty(image, 'naturalWidth', { value: 600 });
    Object.defineProperty(image, 'naturalHeight', { value: 900 });
    fireEvent.load(image);

    expect(row).toHaveAttribute('data-layout', 'two-column');
    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getByTestId('question-image')).toBeInTheDocument();
  });

  it('stays in the stacked layout once a landscape image loads', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              { ...capitalOfFrance, mediaUrl: 'https://example.com/x.png' },
            ],
          },
        ],
        progress: { status: 'question_open' },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const image = screen.getByTestId('question-image');
    Object.defineProperty(image, 'naturalWidth', { value: 900 });
    Object.defineProperty(image, 'naturalHeight', { value: 600 });
    fireEvent.load(image);

    expect(screen.getByTestId('question-prompt-media-row')).toHaveAttribute(
      'data-layout',
      'stacked',
    );
  });

  it('stays in the stacked layout for a portrait image while fullscreen', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              { ...capitalOfFrance, mediaUrl: 'https://example.com/x.png' },
            ],
          },
        ],
        progress: {
          status: 'question_open',
          isMediaFullscreen: true,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const image = screen.getByTestId('question-image');
    Object.defineProperty(image, 'naturalWidth', { value: 600 });
    Object.defineProperty(image, 'naturalHeight', { value: 900 });
    fireEvent.load(image);

    expect(screen.getByTestId('question-prompt-media-row')).toHaveAttribute(
      'data-layout',
      'stacked',
    );
  });

  it('shows how many teams have answered the open question', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [{ questions: [capitalOfFrance] }],
        progress: { status: 'question_open' },
        teams: [
          { teamId: 1, teamName: 'The Quizzards' },
          { teamId: 2, teamName: 'Beer Necessities' },
        ],
        answeredTeams: { 1: [1] },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText(/1 of 2 teams answered/i)).toBeInTheDocument();
  });
});
