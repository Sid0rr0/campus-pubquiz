import { toast } from 'sonner';
import {
  POWER_UP_DESCRIPTIONS,
  POWER_UP_LABELS,
  extraJokerOfferEntry,
  questionPowerUpOffer,
  type AckResult,
  type PlayersStatePayload,
  type PowerUpId,
  type PowerUpSettings,
  type PurchaseView,
  type QuestionView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

export interface PowerUpsListProps {
  settings: PowerUpSettings;
  purchases: PurchaseView[];
  /** The team's coins, shown as its balance. */
  coins: number;
  /** The question being answered right now, or null when nothing can be answered. */
  question: QuestionView | null;
  /** Whether the current round is a quickfire round: the Power-up offer then offers no question power-up. */
  isQuickfire: boolean;
  /** Questions on which the server says Ask the room is ready: a flag only, the phone never learns how many teams answered. */
  roomReadyQuestionIds: number[];
  onBuy: (powerUp: PowerUpId, questionId: number) => Promise<AckResult>;
  /** The round the extra joker could double next (null when none), and the team's joker round, which it cannot double again. */
  extraJokerOffer: PlayersStatePayload['extraJokerOffer'];
  jokerRoundId: number | null;
  onBuyExtraJoker: (roundId: number) => Promise<AckResult>;
  /** Called after the server accepted a purchase: the drawer closes on it. */
  onActivated?: () => void;
}

export function formatCoins(coins: number): string {
  return `${coins} ${coins === 1 ? 'coin' : 'coins'}`;
}

/**
 * The team's balance over the power-ups the session offers (maxUses above 0),
 * each with its cost and how many times this team used it: first those it can
 * use right now, as cards with an activation button, then the rest as plain
 * rows. The server decides every purchase; a refusal is shown as its reason.
 */
export function PowerUpsList({
  settings,
  purchases,
  coins,
  question,
  isQuickfire,
  roomReadyQuestionIds,
  onBuy,
  extraJokerOffer,
  jokerRoundId,
  onBuyExtraJoker,
  onActivated,
}: PowerUpsListProps) {
  const rows = powerUpRows({
    settings,
    purchases,
    coins,
    question,
    isQuickfire,
    roomReadyQuestionIds,
    extraJokerOffer,
    jokerRoundId,
  });
  const available = rows.filter((row) => row.target !== null);
  const unavailable = rows.filter((row) => row.target === null);

  async function activate(powerUp: PowerUpId) {
    const result = await buyFor(powerUp, {
      question,
      extraJokerOffer,
      onBuy,
      onBuyExtraJoker,
    });
    if (result && !result.success) toast.error(result.error);
    if (result?.success) onActivated?.();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="sticky top-0 z-10 bg-background pb-1 text-lg font-extrabold tabular-nums">
        <span className="text-sm text-foreground/70">Balance: </span>
        <span className="font-black text-magenta">{formatCoins(coins)}</span>
      </p>
      {rows.length === 0 && (
        <p className="text-sm text-foreground/55">No power-ups offered.</p>
      )}
      {available.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-extrabold">Available now</h3>
          <ul className="flex flex-col gap-2.5">
            {available.map((row) => (
              <AvailablePowerUp
                key={row.powerUp}
                row={row}
                onActivate={() => void activate(row.powerUp)}
              />
            ))}
          </ul>
        </section>
      )}
      {unavailable.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-extrabold text-foreground/70">
            Not available now
          </h3>
          <ul className="flex flex-col divide-y divide-foreground/10">
            {unavailable.map((row) => (
              <li key={row.powerUp} className="py-2.5">
                <PowerUpDetails {...row} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

interface PowerUpRow {
  powerUp: PowerUpId;
  cost: number;
  maxUses: number;
  used: number;
  /** What the activation button buys it for, or null when it can't be used right now. */
  target: string | null;
  /** Why the activation button is disabled, when only that stands in the way. */
  heldBack: string | null;
}

type RowInputs = Pick<
  PowerUpsListProps,
  | 'settings'
  | 'purchases'
  | 'coins'
  | 'question'
  | 'isQuickfire'
  | 'roomReadyQuestionIds'
  | 'extraJokerOffer'
  | 'jokerRoundId'
>;

/** Every power-up the session offers (maxUses above 0), with what it can be used on right now: the question power-ups from the Power-up offer, the extra joker from the same module. */
function powerUpRows(inputs: RowInputs): PowerUpRow[] {
  const { settings, purchases, coins, question, isQuickfire } = inputs;
  const entries = questionPowerUpOffer({
    settings,
    purchases,
    balance: coins,
    question: question && { ...question, isQuickfire },
    isRoomReady:
      question !== null && inputs.roomReadyQuestionIds.includes(question.id),
  });
  const rows = entries.map(
    ({ outcome, ...entry }): PowerUpRow => ({
      ...entry,
      target: outcome.status === 'unavailable' ? null : 'this question',
      heldBack: outcome.status === 'held_back' ? outcome.reason : null,
    }),
  );
  const extraJoker = extraJokerRow(inputs);
  return extraJoker ? [...rows, extraJoker] : rows;
}

function extraJokerRow({
  settings,
  purchases,
  coins,
  extraJokerOffer: offer,
  jokerRoundId,
}: RowInputs): PowerUpRow | null {
  const entry = extraJokerOfferEntry({
    settings,
    purchases,
    balance: coins,
    jokerRoundId,
    offer,
  });
  if (entry === null) return null;
  const { outcome, roundName, ...rest } = entry;
  return {
    ...rest,
    target:
      outcome.status === 'unavailable' ? null : `the next round: ${roundName}`,
    heldBack: outcome.status === 'held_back' ? outcome.reason : null,
  };
}

/** Asks the server for the purchase; null when there is nothing to buy it for. */
function buyFor(
  powerUp: PowerUpId,
  {
    question,
    extraJokerOffer,
    onBuy,
    onBuyExtraJoker,
  }: Pick<
    PowerUpsListProps,
    'question' | 'extraJokerOffer' | 'onBuy' | 'onBuyExtraJoker'
  >,
): Promise<AckResult | null> {
  if (powerUp === 'extra_joker' && extraJokerOffer) {
    return onBuyExtraJoker(extraJokerOffer.roundId);
  }
  return question ? onBuy(powerUp, question.id) : Promise.resolve(null);
}

function AvailablePowerUp({
  row,
  onActivate,
}: {
  row: PowerUpRow;
  onActivate: () => void;
}) {
  return (
    <li className="rounded-xl border border-foreground/15 bg-white px-4 py-3">
      <PowerUpDetails {...row} />
      <Button
        type="button"
        variant="solid-flat"
        className="mt-3 min-h-12 w-full px-3 py-1.5 disabled:bg-foreground/10 disabled:text-foreground/70"
        aria-label={`Activate ${POWER_UP_LABELS[row.powerUp]}`}
        disabled={row.heldBack !== null}
        onClick={onActivate}
      >
        {row.heldBack ?? `Activate for ${row.target}`}
      </Button>
    </li>
  );
}

/** A power-up's name and what it does, beside what it costs and how often the team used it. */
function PowerUpDetails({
  powerUp,
  cost,
  used,
  maxUses,
}: {
  powerUp: PowerUpId;
  cost: number;
  used: number;
  maxUses: number;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[15px] font-bold">{POWER_UP_LABELS[powerUp]}</p>
        <p className="text-sm text-foreground/70">
          {POWER_UP_DESCRIPTIONS[powerUp]}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs font-extrabold tabular-nums text-foreground/70">
        <p className="font-black text-magenta">{formatCoins(cost)}</p>
        <p className="mt-0.5">
          Used: {used} / {maxUses}
        </p>
      </div>
    </div>
  );
}
