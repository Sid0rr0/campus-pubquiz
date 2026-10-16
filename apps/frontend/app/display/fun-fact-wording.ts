import type {
  BonusCategory,
  FunFact,
  FunFactQuestion,
} from '@campus-pubquiz/types';

/** A fun fact worded for a TV across a room: a large headline and one short line under it. */
export interface FunFactLine {
  headline: string;
  detail: string;
  /** The question's text, when the fact is about one question. */
  prompt?: string;
}

const MS_PER_SECOND = 1000;
const PERCENT = 100;

const BONUS_NOUNS: Record<BonusCategory, { one: string; many: string }> = {
  shot: { one: 'shot', many: 'shots' },
  selfie: { one: 'selfie', many: 'selfies' },
  custom: { one: 'custom bonus', many: 'custom bonuses' },
};

function questionLabel({
  roundNumber,
  questionNumberInRound,
}: FunFactQuestion): string {
  return `Round ${roundNumber} · Q${questionNumberInRound}`;
}

function percent(rate: number): string {
  return `${Math.round(rate * PERCENT)}%`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function describeFunFactLine(fact: FunFact): FunFactLine {
  switch (fact.kind) {
    case 'fastest_correct_answer':
      return {
        headline: fact.teamName,
        detail: `Fastest correct answer: ${(fact.responseMs / MS_PER_SECOND).toFixed(1)} s on ${questionLabel(fact.question)}`,
        prompt: fact.question.prompt,
      };
    case 'toughest_question':
      return {
        headline: questionLabel(fact.question),
        detail: `Toughest question: only ${percent(fact.correctRate)} got it right`,
        prompt: fact.question.prompt,
      };
    case 'room_split':
      return {
        headline: questionLabel(fact.question),
        detail: `The room was split: ${percent(fact.correctRate)} got it right`,
        prompt: fact.question.prompt,
      };
    case 'nobody_got_it':
      return {
        headline: 'Nobody got it',
        detail: questionLabel(fact.question),
        prompt: fact.question.prompt,
      };
    case 'clean_sweep':
      return {
        headline: fact.teamNames.join(', '),
        detail: 'Clean sweep: every question right in the last block',
      };
    case 'answers_so_far':
      return {
        headline: plural(fact.count, 'answer', 'answers'),
        detail: 'submitted so far',
      };
    case 'bonus_awards_so_far':
      return {
        headline: fact.counts
          .map(({ category, count }) =>
            plural(
              count,
              BONUS_NOUNS[category].one,
              BONUS_NOUNS[category].many,
            ),
          )
          .join(', '),
        detail: 'bonus awards so far',
      };
  }
}
