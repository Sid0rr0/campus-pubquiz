import type { QuestionView } from '@campus-pubquiz/types';

export interface FixtureRound {
  title: string;
  breakAfter: boolean;
  questions: QuestionView[];
}

export const HARDCODED_QUIZ: { title: string; rounds: FixtureRound[] } = {
  title: 'Campus Pub Quiz Night',
  rounds: [
    {
      title: 'Round 1: General Knowledge',
      breakAfter: false,
      questions: [
        {
          id: 'r1q1',
          type: 'multiple_choice',
          prompt: 'Capital of France?',
          options: ['Paris', 'London', 'Berlin', 'Rome'],
          points: 2,
        },
        {
          id: 'r1q2',
          type: 'free_text',
          prompt: 'Name the largest planet in the solar system.',
          points: 2,
        },
      ],
    },
    {
      title: 'Round 2: Picture Round',
      breakAfter: true,
      questions: [
        {
          id: 'r2q1',
          type: 'picture',
          prompt: 'Which landmark is shown?',
          mediaUrl: 'https://example.com/landmark.jpg',
          points: 3,
        },
        {
          id: 'r2q2',
          type: 'free_text',
          prompt: 'Name this flag.',
          points: 3,
        },
      ],
    },
  ],
};
