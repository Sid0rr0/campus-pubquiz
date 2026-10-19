import path from 'node:path';
import { PATHS } from './env';

/**
 * What `fixtures/phone-question-types.csv` holds: one round with a `sort`, a
 * `match`, a `number` and a `closest_guess` question, then a break. Each starts
 * one swap away from its key, so a team has to act to get it right.
 */
export const PHONE_QUESTION_TYPES = {
  csvPath: path.join(PATHS.e2eRoot, 'fixtures', 'phone-question-types.csv'),
  roundTitle: 'Phone types',
  sort: {
    prompt: 'Put these planets in order from the Sun',
    /** The order the phone starts with; the key swaps the first two. */
    startOrder: ['Venus', 'Mercury', 'Earth', 'Mars'],
    keyOrder: ['Mercury', 'Venus', 'Earth', 'Mars'],
    /** The item a team moves up once to reach the key. */
    itemToMoveUp: 'Mercury',
    points: 2,
  },
  match: {
    prompt: 'Match each country to its capital',
    lefts: ['France', 'Spain', 'Italy'],
    /** The right-hand column as the phone starts; the key swaps the first two. */
    startRights: ['Madrid', 'Paris', 'Rome'],
    keyRights: ['Paris', 'Madrid', 'Rome'],
    /** Dragging this right item onto `dropOnto` pairs the team with the key. */
    itemToDrag: 'Paris',
    dropOnto: 'Madrid',
    points: 3,
  },
  number: {
    prompt: 'How many bones are in an adult human body?',
    key: '206',
    /** The default 10% margin, as the screens print it. */
    marginText: 'within 10%',
    acceptedRange: '206 (anything from 185.4 to 226.6 counts)',
    /** Inside the margin. */
    rightGuess: '200',
    /** Outside the margin. */
    wrongGuess: '300',
    points: 2,
  },
  closestGuess: {
    prompt: 'How many metres tall is the Eiffel Tower?',
    key: '330',
    /** The closer guess: this team wins the question. */
    closerGuess: '300',
    fartherGuess: '400',
    points: 4,
  },
} as const;
