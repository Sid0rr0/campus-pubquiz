/** A named camp teams play for in a Versus session; the id is stable across renames. */
export interface VersusSide {
  id: string;
  name: string;
}

/** A team picking or switching its own side; the ack says whether it was saved. */
export interface PickSidePayload {
  sideId: string;
}

/** Sent to a team's own phones after its side changed (null: it has none), so every phone of the team shows the same one. */
export interface TeamSideSyncedPayload {
  sideId: string | null;
}

export const SIDE_REMOVAL_REFUSED_MESSAGE =
  "Can't remove a side while a team is on it";

export const MIN_VERSUS_SIDES = 2;
export const MAX_VERSUS_SIDES = 4;

/** Side colours by position in the side list: a side's colour is never stored. */
export const VERSUS_SIDE_COLORS = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
] as const;

export function versusSideColor(index: number): string {
  return VERSUS_SIDE_COLORS[index % VERSUS_SIDE_COLORS.length];
}

export const VERSUS_SIDE_COUNT_MESSAGE = `Versus needs ${MIN_VERSUS_SIDES} to ${MAX_VERSUS_SIDES} sides`;
export const VERSUS_SIDE_NAME_MESSAGE =
  'Side names must be filled in and differ, ignoring case';
export const VERSUS_NOT_FOR_QUICKFIRE_MESSAGE =
  "A quickfire session can't have Versus";

/** The refusal for a Versus setting, or undefined when valid. Sides only matter while Versus is on. */
export function versusSettingsRefusal(settings: {
  versusEnabled?: boolean;
  versusSides?: readonly VersusSide[];
}): string | undefined {
  if (settings.versusEnabled !== true) return undefined;
  const sides = settings.versusSides ?? [];
  if (sides.length < MIN_VERSUS_SIDES || sides.length > MAX_VERSUS_SIDES) {
    return VERSUS_SIDE_COUNT_MESSAGE;
  }
  const names = sides.map((side) => side.name.trim().toLowerCase());
  return names.some((name) => name === '') ||
    new Set(names).size !== names.length
    ? VERSUS_SIDE_NAME_MESSAGE
    : undefined;
}
