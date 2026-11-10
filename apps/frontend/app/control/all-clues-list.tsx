import { clueValue } from '@campus-pubquiz/types';

function clueState(clue: number, highestClue: number | undefined) {
  if (highestClue === undefined) return undefined;
  if (clue === highestClue) return 'latest';
  return clue < highestClue ? 'shown' : 'hidden';
}

const STATE_CLASSES = {
  latest: 'border-2 border-cyan bg-cyan/10 font-extrabold',
  shown: 'border border-foreground/15 bg-white',
  hidden: 'border border-foreground/10 bg-white text-foreground/45',
};

/** Staff view (/control, /remote) of a Clue question's every clue with its value; given the highest clue shown, marks which the room has seen. */
export function AllCluesList({
  clues,
  highestClue,
}: {
  clues: string[];
  highestClue?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-extrabold tracking-wide text-foreground/55">
        Clues
      </h3>
      <ol aria-label="Clues" className="flex flex-col gap-1 text-sm">
        {clues.map((clue, index) => {
          const state = clueState(index + 1, highestClue);
          const value = clueValue(clues.length, index + 1);
          return (
            <li
              key={`${clue}-${index}`}
              data-state={state}
              className={`flex justify-between gap-2 rounded-lg px-3 py-1 ${STATE_CLASSES[state ?? 'shown']}`}
            >
              <span>
                {index + 1}. {clue}
              </span>
              <span className="shrink-0 text-xs font-bold text-foreground/60">
                {value} pt{value === 1 ? '' : 's'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
