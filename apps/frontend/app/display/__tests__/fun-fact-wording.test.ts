import { describe, expect, it } from 'vitest';
import type { FunFactQuestion } from '@campus-pubquiz/types';
import { describeFunFactLine } from '@/app/display/fun-fact-wording';

const QUESTION: FunFactQuestion = {
  questionId: 7,
  roundNumber: 2,
  questionNumberInRound: 3,
  prompt: 'Capital of Peru?',
  answer: 'Lima',
};
const ABOUT_QUESTION = { prompt: 'Capital of Peru?', answer: 'Lima' };

describe('describeFunFactLine', () => {
  it('words the fastest correct answer in seconds with one decimal', () => {
    expect(
      describeFunFactLine({
        kind: 'fastest_correct_answer',
        teamName: 'Quizzy',
        responseMs: 1234,
        question: QUESTION,
      }),
    ).toEqual({
      headline: 'Quizzy',
      detail: 'Fastest correct answer: 1.2 s on Round 2 · Q3',
      ...ABOUT_QUESTION,
    });
  });

  it('words the toughest question with a rounded percentage', () => {
    expect(
      describeFunFactLine({
        kind: 'toughest_question',
        correctRate: 0.256,
        question: QUESTION,
      }),
    ).toEqual({
      headline: 'Round 2 · Q3',
      detail: 'Toughest question: only 26% got it right',
      ...ABOUT_QUESTION,
    });
  });

  it('words the room split', () => {
    expect(
      describeFunFactLine({
        kind: 'room_split',
        correctRate: 0.5,
        question: QUESTION,
      }),
    ).toEqual({
      headline: 'Round 2 · Q3',
      detail: 'The room was split: 50% got it right',
      ...ABOUT_QUESTION,
    });
  });

  it('words a question nobody got', () => {
    expect(
      describeFunFactLine({ kind: 'nobody_got_it', question: QUESTION }),
    ).toEqual({
      headline: 'Nobody got it',
      detail: 'Round 2 · Q3',
      ...ABOUT_QUESTION,
    });
  });

  it('words a Clue question cracked early', () => {
    const fact = {
      kind: 'clue_cracked_early' as const,
      teamNames: ['Ants', 'Bees'],
      question: QUESTION,
    };
    expect(describeFunFactLine({ ...fact, clue: 1 })).toEqual({
      headline: 'Ants, Bees',
      detail: 'Cracked it early: Round 2 · Q3 on the first clue',
      ...ABOUT_QUESTION,
    });
    expect(describeFunFactLine({ ...fact, clue: 3 }).detail).toBe(
      'Cracked it early: Round 2 · Q3 on clue 3',
    );
  });

  it('words a Clue question only cracked late', () => {
    expect(
      describeFunFactLine({
        kind: 'clue_last_gasp',
        clue: 5,
        question: QUESTION,
      }),
    ).toEqual({
      headline: 'Nobody got it until clue 5',
      detail: 'Round 2 · Q3',
      ...ABOUT_QUESTION,
    });
  });

  it('lists the clean sweep teams separated by comma and space', () => {
    expect(
      describeFunFactLine({ kind: 'clean_sweep', teamNames: ['Ants', 'Bees'] }),
    ).toEqual({
      headline: 'Ants, Bees',
      detail: 'Clean sweep: every question right in the last block',
    });
  });

  it('words the perfect rounds fact for many teams and for a single named team', () => {
    expect(
      describeFunFactLine({ kind: 'perfect_rounds', teamCount: 3 }),
    ).toEqual({
      headline: '3 teams',
      detail: 'have had a perfect round so far',
    });
    expect(
      describeFunFactLine({
        kind: 'perfect_rounds',
        teamCount: 1,
        teamName: 'Ants',
      }),
    ).toEqual({
      headline: 'Only Ants',
      detail: 'has had a perfect round so far',
    });
  });

  it('words the favourite joker round with a singular or plural team count', () => {
    const favourite = (teamCount: number) =>
      describeFunFactLine({
        kind: 'joker_favourite_round',
        roundNumber: 3,
        roundTitle: 'Sport',
        teamCount,
      });
    expect(favourite(1)).toEqual({
      headline: 'Round 3 — Sport',
      detail: '1 team bet their joker on it',
    });
    expect(favourite(4).detail).toBe('4 teams bet their joker on it');
  });

  it('words the snubbed joker round', () => {
    expect(
      describeFunFactLine({
        kind: 'joker_snubbed_round',
        roundNumber: 3,
        roundTitle: 'Sport',
      }),
    ).toEqual({
      headline: 'Nobody trusted themselves with Round 3 — Sport',
      detail: 'Not one joker on it',
    });
  });

  it('words the drawn joker count with a singular or plural team', () => {
    const drawn = (teamCount: number) =>
      describeFunFactLine({ kind: 'joker_drawn_count', teamCount });
    expect(drawn(1)).toEqual({
      headline: '1 team',
      detail: 'ran out of time and got a random joker',
    });
    expect(drawn(2).headline).toBe('2 teams');
  });

  it('words the best joker', () => {
    expect(
      describeFunFactLine({
        kind: 'best_joker',
        teamName: 'Quizzy',
        roundNumber: 3,
        roundTitle: 'Sport',
        extraPoints: 6,
      }),
    ).toEqual({
      headline: 'Quizzy',
      detail: 'Best joker so far: Round 3 — Sport, +6',
    });
  });

  it('words the backfired joker', () => {
    expect(
      describeFunFactLine({
        kind: 'joker_backfired',
        teamName: 'Quizzy',
        roundNumber: 3,
        roundTitle: 'Sport',
      }),
    ).toEqual({
      headline: 'Quizzy',
      detail: 'Joker backfired: Round 3 — Sport was their worst round',
    });
  });

  it('words each bonus category in singular and plural, comma separated', () => {
    expect(
      describeFunFactLine({
        kind: 'bonus_awards_so_far',
        counts: [
          { category: 'shot', count: 1 },
          { category: 'selfie', count: 2 },
          { category: 'custom', count: 1 },
        ],
      }),
    ).toEqual({
      headline: '1 shot, 2 selfies, 1 custom bonus',
      detail: 'bonus awards so far',
    });
    expect(
      describeFunFactLine({
        kind: 'bonus_awards_so_far',
        counts: [
          { category: 'shot', count: 3 },
          { category: 'custom', count: 2 },
        ],
      }).headline,
    ).toBe('3 shots, 2 custom bonuses');
  });
});
