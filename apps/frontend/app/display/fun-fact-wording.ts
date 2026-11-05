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

type FactOf<Kind extends FunFact['kind']> = Extract<FunFact, { kind: Kind }>;

/** Each fact kind's wording; the ones about a question carry its prompt and answer. */
const FUN_FACT_LINES: {
  [Kind in FunFact['kind']]: (fact: FactOf<Kind>) => FunFactLine;
} = {
  fastest_correct_answer: (fact) => ({
    headline: fact.teamName,
    detail: `Fastest correct answer: ${(fact.responseMs / MS_PER_SECOND).toFixed(1)} s on ${questionLabel(fact.question)}`,
    prompt: fact.question.prompt,
    answer: fact.question.answer,
  }),
  toughest_question: (fact) => ({
    headline: questionLabel(fact.question),
    detail: `Toughest question: only ${percent(fact.correctRate)} got it right`,
    prompt: fact.question.prompt,
    answer: fact.question.answer,
  }),
  room_split: (fact) => ({
    headline: questionLabel(fact.question),
    detail: `The room was split: ${percent(fact.correctRate)} got it right`,
    prompt: fact.question.prompt,
    answer: fact.question.answer,
  }),
  nobody_got_it: (fact) => ({
    headline: 'Nobody got it',
    detail: questionLabel(fact.question),
    prompt: fact.question.prompt,
    answer: fact.question.answer,
  }),
  clean_sweep: (fact) => ({
    headline: fact.teamNames.join(', '),
    detail: 'Clean sweep: every question right in the last block',
  }),
  joker_favourite_round: (fact) => ({
    headline: `Round ${fact.roundNumber} — ${fact.roundTitle}`,
    detail: `${plural(fact.teamCount, 'team', 'teams')} bet their joker on it`,
  }),
  joker_snubbed_round: (fact) => ({
    headline: `Nobody trusted themselves with Round ${fact.roundNumber} — ${fact.roundTitle}`,
    detail: 'Not one joker on it',
  }),
  joker_drawn_count: (fact) => ({
    headline: plural(fact.teamCount, 'team', 'teams'),
    detail: 'ran out of time and got a random joker',
  }),
  best_joker: (fact) => ({
    headline: fact.teamName,
    detail: `Best joker so far: Round ${fact.roundNumber} — ${fact.roundTitle}, +${fact.extraPoints}`,
  }),
  joker_backfired: (fact) => ({
    headline: fact.teamName,
    detail: `Joker backfired: Round ${fact.roundNumber} — ${fact.roundTitle} was their worst round`,
  }),
  bonus_awards_so_far: (fact) => ({
    headline: fact.counts
      .map(({ category, count }) =>
        plural(count, BONUS_NOUNS[category].one, BONUS_NOUNS[category].many),
      )
      .join(', '),
    detail: 'bonus awards so far',
  }),
};

export function describeFunFactLine(fact: FunFact): FunFactLine {
  const describe = FUN_FACT_LINES[fact.kind] as (fact: FunFact) => FunFactLine;
  return describe(fact);
}
