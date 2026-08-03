import type { QuestionView } from '@campus-pubquiz/types';

// Extends the player-safe QuestionView with the correct answer, which the
// seed inserts into the DB payload for the admin-only quiz summary — never
// sent to players (see SeedService.toViewPayload).
interface FixtureQuestion extends QuestionView {
  answer: string;
  /** Shown alongside the answer during reveal only — independent of the question's own media_url. */
  answerMediaUrl?: string;
}

export interface FixtureRound {
  title: string;
  breakAfter: boolean;
  questions: FixtureQuestion[];
}

export const HARDCODED_QUIZ: { title: string; rounds: FixtureRound[] } = {
  title: 'Campus Pub Quiz Night',
  rounds: [
    {
      title: 'Round 1: General Knowledge',
      breakAfter: false,
      questions: [
        {
          id: 1,
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          answer: 'Paris',
          points: 2,
        },
        {
          id: 2,
          type: 'free_text',
          prompt: 'Name the largest planet in the solar system.',
          answer: 'Jupiter',
          points: 2,
        },
      ],
    },
    {
      title: 'Round 2: Picture Round',
      breakAfter: true,
      questions: [
        {
          id: 3,
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          answer: 'Eiffel Tower',
          points: 3,
        },
        {
          id: 4,
          type: 'free_text',
          prompt: 'Name this flag.',
          answer: 'France',
          answerMediaUrl: 'https://example.com/france-flag.jpg',
          points: 3,
        },
        {
          id: 5,
          type: 'audio',
          prompt: 'Name this song.',
          mediaUrl: 'https://example.com/song.mp3',
          answer: 'Bohemian Rhapsody',
          points: 3,
        },
      ],
    },
  ],
};
