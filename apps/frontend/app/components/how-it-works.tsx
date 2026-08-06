const STEPS = [
  {
    number: 1,
    color: 'bg-magenta',
    title: 'Enter the code',
    body: 'The quiz master shares a game code on the big screen. Type it in below.',
  },
  {
    number: 2,
    color: 'bg-cyan',
    title: 'Answer as a team',
    body: 'Every phone at the table stays in sync — anyone can submit for the group.',
  },
  {
    number: 3,
    color: 'bg-green',
    title: 'Climb the board',
    body: 'Scores update live between rounds. Keep your team code to play again next time.',
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-2 pt-8">
      <div className="flex flex-wrap justify-center gap-4">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="max-w-[280px] flex-1 basis-[220px] rounded-3xl border-2 border-foreground/10 bg-white p-5 shadow-[0_10px_24px_rgba(46,49,146,0.08)]"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-base text-white ${step.color}`}
            >
              {step.number}
            </div>
            <p className="mb-1 mt-3.5 text-base font-extrabold">{step.title}</p>
            <p className="text-sm leading-relaxed text-foreground/65">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
