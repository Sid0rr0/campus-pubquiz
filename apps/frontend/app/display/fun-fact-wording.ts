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
  /** That question's correct answer: rounds can repeat a prompt over different media. */
  answer?: string;
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
        answer: fact.question.answer,
      };
    case 'toughest_question':
      return {
        headline: questionLabel(fact.question),
        detail: `Toughest question: only ${percent(fact.correctRate)} got it right`,
        prompt: fact.question.prompt,
        answer: fact.question.answer,
      };
    case 'room_split':
      return {
        headline: questionLabel(fact.question),
        detail: `The room was split: ${percent(fact.correctRate)} got it right`,
        prompt: fact.question.prompt,
        answer: fact.question.answer,
      };
    case 'nobody_got_it':
      return {
        headline: 'Nobody got it',
        detail: questionLabel(fact.question),
        prompt: fact.question.prompt,
        answer: fact.question.answer,
      };
    case 'clean_sweep':
      return {
        headline: fact.teamNames.join(', '),
        detail: 'Clean sweep: every question right in the last block',
      };
    case 'joker_favourite_round':
      return {
        headline: `Round ${fact.roundNumber} — ${fact.roundTitle}`,
        detail: `${plural(fact.teamCount, 'team', 'teams')} bet their joker on it`,
      };
    case 'joker_snubbed_round':
      return {
        headline: `Nobody trusted themselves with Round ${fact.roundNumber} — ${fact.roundTitle}`,
        detail: 'Not one joker on it',
      };
    case 'joker_drawn_count':
      return {
        headline: plural(fact.teamCount, 'team', 'teams'),
        detail: 'ran out of time and got a random joker',
      };
    case 'best_joker':
      return {
        headline: fact.teamName,
        detail: `Best joker so far: Round ${fact.roundNumber} — ${fact.roundTitle}, +${fact.extraPoints}`,
      };
    case 'joker_backfired':
      return {
        headline: fact.teamName,
        detail: `Joker backfired: Round ${fact.roundNumber} — ${fact.roundTitle} was their worst round`,
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
