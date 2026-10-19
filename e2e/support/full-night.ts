/**
 * What `fixtures/full-night.csv` holds, and the session fixture that plays it.
 * Three blocks: warm-up and music (break), a film-and-numbers round (break),
 * then a kahoot round. Every question type, media of each kind (image, audio,
 * video), round categories and authors, a round note shown on screen and one
 * that isn't.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { expect } from '@playwright/test';
import { test as base } from '../fixtures';
import { seedCsvSession } from './csv-session';
import { PATHS } from './env';

const CSV_PATH = path.join(PATHS.e2eRoot, 'fixtures', 'full-night.csv');
/** Long enough for all three screens to be snapshotted while the countdown runs. */
const LOCK_GRACE_SECONDS = 5;
const KAHOOT_ROUND_INDEX = 3;

export const FULL_NIGHT = {
  warmUp: {
    title: 'Warm-up',
    number: 1,
    category: 'General knowledge',
    author: 'Alex Author',
    /** Shown on the big screen's round intro. */
    note: 'Phones face down and pens up.',
    capital: {
      prompt: 'What is the capital of France?',
      key: 'Paris',
      points: 2,
      halfPoints: 1,
    },
    planet: {
      prompt: 'Which planet is known as the Red Planet?',
      right: 'Mars',
      wrong: 'Venus',
      points: 3,
      imageUrl: 'https://example.invalid/e2e-planet.png',
    },
  },
  music: {
    title: 'Name that tune',
    number: 2,
    category: 'Music',
    author: 'Sam Spinner',
    /** Written for the moderator, not shown on the big screen. */
    note: 'Headphones off and ears open.',
    band: {
      prompt: 'Which band recorded the song you hear?',
      key: 'Queen',
      wrong: 'Beatles',
      points: 1,
      audioUrl: 'https://example.invalid/e2e-clip.mp3',
    },
    sort: { prompt: 'Put the planets in order from the Sun', points: 2 },
  },
  film: {
    title: 'Look closer',
    number: 3,
    category: 'Film & TV',
    author: 'Pat Projector',
    piano: { prompt: 'How many keys does a standard piano have?' },
    clip: {
      prompt: 'Which film is this clip from?',
      key: 'Inception',
      wrong: 'Memento',
      points: 1,
    },
    match: { prompt: 'Match each capital to its country' },
    wall: {
      prompt: 'In which year did the Berlin Wall fall?',
      right: '1989',
      wrong: '1500',
      points: 2,
    },
  },
  quickFire: {
    title: 'Quick fire',
    number: 4,
    category: 'Sports',
    author: 'Kay Kahoot',
    badminton: {
      prompt: 'Which sport uses a shuttlecock?',
      right: 'Badminton',
      wrong: 'Tennis',
      points: 2,
    },
    football: {
      prompt: 'How many players does a football team field?',
      right: '11',
      wrong: '20',
      points: 2,
    },
  },
  /** The bonus the quiz master awards Team B in the first break (the default is one point). */
  bonusPoints: 1,
} as const;

/** `test` with a session on the full-night quiz: round overview on, a 5 s lock countdown. The last round becomes a kahoot round (the CSV has no column for it). */
export const test = base.extend({
  session: async ({ adminApi }, use) => {
    const quizTitle = `Full night ${randomUUID().slice(0, 6)}`;
    await use(
      await seedCsvSession(
        adminApi,
        CSV_PATH,
        quizTitle,
        { lockGraceSeconds: LOCK_GRACE_SECONDS, showRoundOverview: true },
        (round, index) =>
          index === KAHOOT_ROUND_INDEX ? { ...round, kahootMode: true } : round,
      ),
    );
  },
});

export { expect };
