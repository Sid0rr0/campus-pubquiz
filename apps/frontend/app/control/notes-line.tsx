/** A question's notes, wrapped in full, for the quiz master only. */
export function NotesLine({ notes }: { notes: string }) {
  return (
    <p className="text-sm text-foreground/70">
      <span className="font-extrabold text-magenta">Notes:</span> {notes}
    </p>
  );
}
