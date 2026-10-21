import type { SeededGame } from '@campus-pubquiz/types';

/** The summary facts a hand-built `SeededGame` fixture needs but a projection test doesn't care about. */
export const SEEDED_GAME_SUMMARY_DEFAULTS: Pick<
  SeededGame,
  'quizTitle' | 'customName' | 'startedAt'
> = {
  quizTitle: 'Test Quiz',
  customName: null,
  startedAt: new Date('2026-09-16T12:00:00.000Z'),
};
