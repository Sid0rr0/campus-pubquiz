const STEPS = ['Pick tonight’s game', 'Answer as a team', 'Climb the board'];

/** The three steps, printed small under the join ticket like the back of one. */
export function HowItWorks() {
  return (
    <ol className="mx-auto flex max-w-md flex-wrap sm:max-w-3xl justify-center gap-x-4 gap-y-1 px-6 text-sm font-bold text-foreground/70">
      {STEPS.map((step, index) => (
        <li key={step}>
          <span className="font-display text-magenta">{index + 1}</span> {step}
        </li>
      ))}
    </ol>
  );
}
