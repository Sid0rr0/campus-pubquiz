import {
  POWER_UP_DESCRIPTIONS,
  POWER_UP_IDS,
  POWER_UP_LABELS,
  QUESTION_KINDS,
  QUESTION_TYPES,
} from '@campus-pubquiz/types';

const POWER_UP_NOTES = POWER_UP_IDS.map(
  (powerUp) => `${POWER_UP_LABELS[powerUp]}: ${POWER_UP_DESCRIPTIONS[powerUp]}`,
);

const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: 'Basics',
    lines: [
      'Join on your phone with the game code or QR code, and keep your team code in case you need to rejoin.',
      'Questions come in rounds on the big screen. Change your answers as often as you like until they lock; the last one counts.',
      'Answers are revealed after the break.',
    ],
  },
  {
    title: 'Scoring',
    lines: [
      "A right answer earns the question's points; the quiz master can also give half.",
      'In a kahoot round each question locks on its own, and faster right answers earn more, down to half the points.',
      'The leaderboard adds up answers and bonuses. A tie can be settled by a showdown.',
    ],
  },
  {
    title: 'Bonuses',
    lines: [
      'The quiz master can give points for shots, selfies or anything else, or take them away as a penalty.',
    ],
  },
  {
    title: 'Joker',
    lines: [
      "If the quiz has jokers, pick one round at the start of the quiz: your answer points in that round count double, bonuses don't. Pick nothing and you get a random round.",
    ],
  },
  {
    title: 'Power-ups',
    lines: [
      'If the quiz has them, spend coins on your phone. Coins are never points. If your team rated all rounds of the last pub quiz, you get 2 bonus coins. Earn more from shots, selfies and the quiz master.',
      ...POWER_UP_NOTES,
    ],
  },
  {
    title: 'Question types',
    lines: QUESTION_TYPES.map(
      (type) =>
        `${QUESTION_KINDS[type].label}: ${QUESTION_KINDS[type].playerNote}`,
    ),
  },
];

/** The game mechanics for players — /how-to-play. Public: no login. */
export default function HowToPlayPage() {
  return (
    <main className="flex min-h-screen justify-center bg-background px-6 py-10 text-foreground">
      <div className="flex max-w-3xl flex-col gap-6 text-left">
        <h1 className="text-center font-display text-3xl">
          <span className="text-magenta">How to play</span>
        </h1>
        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h2 className="font-display text-xl text-cyan">{section.title}</h2>
            {section.lines.map((line) => (
              <p key={line} className="text-lg">
                {line}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
