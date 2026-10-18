import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const generalKnowledge = {
  title: 'General Knowledge',
  questions: [
    {
      type: 'multiple_choice' as const,
      prompt: 'Capital of France?',
      options: ['Paris', 'London'],
      points: 2,
      answer: 'Paris',
    },
    {
      type: 'free_text' as const,
      prompt: 'Largest planet?',
      points: 2,
      answer: 'Jupiter',
    },
  ],
};

describe('DisplayPage — reveal', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=ABCDEF');
  });

  it('shows the current reveal question with its correct answer, same layout as when it was asked', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [generalKnowledge],
        progress: { status: 'reveal', questionIndex: 1, revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Capital of France?')).toBeInTheDocument();
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0);
    expect(screen.getByText('London')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.queryByText('Largest planet?')).not.toBeInTheDocument();
  });

  it('draws the closest-guess sequence for a closest_guess reveal question', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
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
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('How tall is the tower?')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.queryByText('55')).not.toBeInTheDocument();
  });

  it('shows the key and the accepted range for a Number question on reveal', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'number',
                prompt: 'How many bones?',
                answer: '200',
                margin: { value: 10, unit: 'percent' },
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('200 · 180–220 accepted')).toBeInTheDocument();
  });

  it('shows the correct order for a sort question on reveal', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'sort',
                prompt: 'Order these planets from the sun outward.',
                options: ['Earth', 'Venus', 'Mercury'],
                points: 3,
                answer: 'Mercury|Venus|Earth',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const items = screen.getAllByText(/Mercury|Venus|Earth/);
    expect(items.map((el) => el.textContent)).toEqual([
      'Mercury',
      'Venus',
      'Earth',
    ]);
  });

  it('shows the correct pairs for a match question on reveal', () => {
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
                answer: 'excalibur|shield',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('arthur')).toBeInTheDocument();
    expect(screen.getByText('excalibur')).toBeInTheDocument();
    expect(screen.getByText('captain america')).toBeInTheDocument();
    expect(screen.getByText('shield')).toBeInTheDocument();
    // arthur is left #1, paired to excalibur which is right list letter b (index 1);
    // captain america is left #2, paired to shield which is right list letter a (index 0).
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('shows the second reveal question when revealIndex advances', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [generalKnowledge],
        progress: { status: 'reveal', questionIndex: 1, revealIndex: 1 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Largest planet?')).toBeInTheDocument();
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
    expect(screen.getByText(/round 1/i)).toBeInTheDocument();
    expect(
      screen.getByText(/revealing answers.*question 2/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Capital of France?')).not.toBeInTheDocument();
  });

  it("shows a round intro card with the question's own round title before revealing a new round's answers, even for a block spanning multiple rounds", () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          { ...generalKnowledge, breakAfter: false },
          {
            title: 'Geography',
            questions: [
              {
                type: 'free_text',
                prompt: 'Tallest mountain?',
                points: 2,
                answer: 'Everest',
              },
            ],
          },
        ],
        progress: {
          status: 'reveal_intro',
          roundIndex: 1,
          questionIndex: 0,
          revealIndex: 2,
        },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.getByText(/round 2/i)).toBeInTheDocument();
    expect(screen.queryByText('General Knowledge')).not.toBeInTheDocument();
    expect(screen.queryByText('Tallest mountain?')).not.toBeInTheDocument();
  });

  it('shows media for an image mediaUrl and audio reveal questions', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Which landmark?',
                mediaUrl: 'https://example.com/landmark.jpg',
                points: 3,
                answer: 'Eiffel Tower',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-image')).toHaveAttribute(
      'src',
      'https://example.com/landmark.jpg',
    );
  });

  it('highlights the correct choice of an audio question that has choices', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'audio',
                prompt: 'Which song is this?',
                mediaUrl: 'https://example.com/song.mp3',
                options: ['Yesterday', 'Help!'],
                points: 1,
                answer: 'Help!',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    const correctItem = screen
      .getByText('Help!', {
        selector: 'li span',
      })
      .closest('li');
    expect(correctItem).toHaveClass('border-green');
  });

  it('shows only the answer line for an audio question whose choices are all blank', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'audio',
                prompt: 'Which song is this?',
                mediaUrl: 'https://example.com/song.mp3',
                options: [' '],
                points: 1,
                answer: 'Help!',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('Help!')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('places the answer text above the picture on reveal', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Which landmark?',
                mediaUrl: 'https://example.com/landmark.jpg',
                points: 3,
                answer: 'Eiffel Tower',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    const answer = screen.getByText('Eiffel Tower');
    const image = screen.getByTestId('reveal-image');
    expect(
      answer.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows both media_url and answer_media_url side by side on reveal when the question media is an image', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Which landmark?',
                mediaUrl: 'https://example.com/landmark.jpg',
                points: 3,
                answer: 'Eiffel Tower',
                answerMediaUrl: 'https://example.com/eiffel-plaque.jpg',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-image')).toHaveAttribute(
      'src',
      'https://example.com/eiffel-plaque.jpg',
    );
    expect(screen.getByTestId('reveal-image')).toHaveAttribute(
      'src',
      'https://example.com/landmark.jpg',
    );
  });

  it('shows an answer_media_url image on reveal for a free_text question, independent of type', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Name this flag.',
                points: 3,
                answer: 'France',
                answerMediaUrl: 'https://example.com/france-flag.jpg',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-image')).toHaveAttribute(
      'src',
      'https://example.com/france-flag.jpg',
    );
  });

  it('renders an answer_media_url ending in an audio extension as audio, not an image', () => {
    mockUseGame.mockReturnValue({
      snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
        rounds: [
          {
            questions: [
              {
                type: 'free_text',
                prompt: 'Name this flag.',
                points: 3,
                answer: 'France',
                answerMediaUrl: 'https://example.com/anthem.mp3',
              },
            ],
          },
        ],
        progress: { status: 'reveal', revealIndex: 0 },
      }),
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByTestId('reveal-answer-audio')).toHaveAttribute(
      'src',
      'https://example.com/anthem.mp3',
    );
    expect(screen.queryByTestId('reveal-answer-image')).not.toBeInTheDocument();
  });

  describe('reveal clip', () => {
    const QUESTION_VIDEO = 'https://youtu.be/dQw4w9WgXcQ';
    const ANSWER_VIDEO = 'https://youtu.be/9bZkp7q19f0';
    const embed = (id: string, params: string) =>
      `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&modestbranding=1&enablejsapi=1${params}`;

    // The vitest config turns iframe page loading off; happy-dom logs that on
    // every embed mount. Drop exactly that message, let other errors through.
    beforeEach(() => {
      const originalConsoleError = console.error.bind(console);
      vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        const [first] = args;
        const message = first instanceof Error ? first.message : String(first);
        if (message.includes('Iframe page loading is disabled')) return;
        originalConsoleError(...args);
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function renderQuestion(
      progress:
        | { status: 'question_open' }
        | { status: 'reveal'; revealIndex: number },
      fields: Record<string, unknown>,
    ) {
      mockUseGame.mockReturnValue({
        snapshot: roomView(SOCKET_ROOMS.DISPLAY, {
          rounds: [
            {
              questions: [
                {
                  type: 'free_text',
                  prompt: 'Name this video.',
                  points: 3,
                  answer: 'Rickroll',
                  mediaUrl: QUESTION_VIDEO,
                  mediaStartSeconds: 10,
                  mediaEndSeconds: 20,
                  ...fields,
                },
              ],
            },
          ],
          progress,
        }),
        connectionError: null,
        sendAction: vi.fn(),
      });
      render(<DisplayPage />);
    }

    it('leaves exactly one iframe at reveal with a YouTube answer media, clipped by the reveal clip', () => {
      renderQuestion(
        { status: 'reveal', revealIndex: 0 },
        {
          answerMediaUrl: ANSWER_VIDEO,
          revealStartSeconds: 150,
          revealEndSeconds: 165,
        },
      );

      expect(document.querySelectorAll('iframe')).toHaveLength(1);
      expect(screen.getByTestId('reveal-answer-youtube')).toHaveAttribute(
        'src',
        embed('9bZkp7q19f0', '&start=150&end=165'),
      );
    });

    it('plays the whole answer video when the reveal clip is empty', () => {
      renderQuestion(
        { status: 'reveal', revealIndex: 0 },
        { answerMediaUrl: ANSWER_VIDEO },
      );

      expect(screen.getByTestId('reveal-answer-youtube')).toHaveAttribute(
        'src',
        embed('9bZkp7q19f0', ''),
      );
    });

    it('plays the question video again at reveal with the reveal clip, not the question clip', () => {
      renderQuestion(
        { status: 'reveal', revealIndex: 0 },
        { revealStartSeconds: 150, revealEndSeconds: 165 },
      );

      expect(document.querySelectorAll('iframe')).toHaveLength(1);
      expect(screen.getByTestId('reveal-youtube')).toHaveAttribute(
        'src',
        embed('dQw4w9WgXcQ', '&start=150&end=165'),
      );
    });

    it('plays the whole question video at reveal when the reveal clip is empty', () => {
      renderQuestion({ status: 'reveal', revealIndex: 0 }, {});

      expect(screen.getByTestId('reveal-youtube')).toHaveAttribute(
        'src',
        embed('dQw4w9WgXcQ', ''),
      );
    });

    it('still applies the question clip while the question is asked', () => {
      renderQuestion(
        { status: 'question_open' },
        { revealStartSeconds: 150, revealEndSeconds: 165 },
      );

      expect(screen.getByTestId('question-youtube')).toHaveAttribute(
        'src',
        embed('dQw4w9WgXcQ', '&start=10&end=20'),
      );
    });
  });

  it('draws the header exactly as the view provides it, not from its own derivation', () => {
    mockUseGame.mockReturnValue({
      snapshot: {
        ...roomView(SOCKET_ROOMS.DISPLAY, {
          rounds: [generalKnowledge],
          progress: { status: 'reveal', questionIndex: 1, revealIndex: 0 },
        }),
        // Overridden on purpose: the real header for this state reads
        // differently, so the page showing this one proves it draws what it is sent.
        header: {
          label: 'ROUND 9',
          title: 'Served Title',
          badge: 'SERVED BADGE',
        },
      },
      connectionError: null,
      sendAction: vi.fn(),
    });
    render(<DisplayPage />);

    expect(screen.getByText('ROUND 9')).toBeInTheDocument();
    expect(screen.getByText('Served Title')).toBeInTheDocument();
    expect(screen.getByText('SERVED BADGE')).toBeInTheDocument();
  });
});
