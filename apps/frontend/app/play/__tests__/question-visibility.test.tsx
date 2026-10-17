import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PlayPage from '@/app/play/page';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('PlayPage — question visibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(teamLinkResult());
  });

  it('shows the current question once joined and connected', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                { type: 'free_text', prompt: 'Name a fruit', points: 1 },
              ],
            },
          ],
          progress: { status: 'question_open' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('keeps showing the question and answer form during the locking countdown', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                { type: 'free_text', prompt: 'Name a fruit', points: 1 },
              ],
            },
          ],
          progress: { status: 'locking' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText('Name a fruit')).toBeInTheDocument();
  });

  it('shows a hint to look at the big screen for a question with an image mediaUrl', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'free_text',
                  prompt: 'Which landmark is shown?',
                  mediaUrl: 'https://example.com/landmark.jpg',
                  points: 3,
                },
              ],
            },
          ],
          progress: { status: 'question_open' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('shows a hint to look at the big screen for an audio question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'audio',
                  prompt: 'Name this song.',
                  mediaUrl: 'https://example.com/song.mp3',
                  points: 3,
                },
              ],
            },
          ],
          progress: { status: 'question_open' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('shows the screen hint for a free-text question carrying a media_url, regardless of type', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                {
                  type: 'free_text',
                  prompt: 'Name this flag.',
                  mediaUrl: 'https://example.com/france-flag.jpg',
                  points: 1,
                },
              ],
            },
          ],
          progress: { status: 'question_open' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.getByText(/look at the screen/i)).toBeInTheDocument();
  });

  it('does not show the screen hint for a free-text question', () => {
    window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
    mockUseTeamLink.mockReturnValue(
      teamLinkResult({
        session: {
          rounds: [
            {
              questions: [
                { type: 'free_text', prompt: 'Name a fruit', points: 1 },
              ],
            },
          ],
          progress: { status: 'question_open' },
        },
      }),
    );
    renderWithQuery(<PlayPage />);

    expect(screen.queryByText(/look at the screen/i)).not.toBeInTheDocument();
  });

  it.each([
    [true, /listen/i, /look at the screen/i],
    [false, /look at the screen/i, /listen/i],
  ])(
    'for a YouTube video with isVideoHidden=%s shows the matching hint',
    (isVideoHidden, shown, notShown) => {
      window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
      mockUseTeamLink.mockReturnValue(
        teamLinkResult({
          session: {
            rounds: [
              {
                questions: [
                  {
                    type: 'free_text',
                    prompt: 'Name this song.',
                    mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
                    ...(isVideoHidden ? { isVideoHidden } : {}),
                    points: 3,
                  },
                ],
              },
            ],
            progress: { status: 'question_open' },
          },
        }),
      );
      renderWithQuery(<PlayPage />);

      expect(screen.getByText(shown)).toBeInTheDocument();
      expect(screen.queryByText(notShown)).not.toBeInTheDocument();
    },
  );
});
