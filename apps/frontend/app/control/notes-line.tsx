/** A question's notes on one line (the full text on hover), for the quiz master only. */
export function NotesLine({ notes }: { notes: string }) {
  return (
    <p className="truncate text-sm text-foreground/70" title={notes}>
      <span className="font-extrabold text-magenta">Notes:</span> {notes}
    </p>
  );
}
