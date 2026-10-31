import { toast } from 'sonner';
import {
  POWER_UP_DESCRIPTIONS,
  POWER_UP_IDS,
  POWER_UP_LABELS,
  powerUpApplies,
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
  /** Questions on which the server says Ask the room is ready: a flag only, the phone never learns how many teams answered. */
  roomReadyQuestionIds: number[];
  onBuy: (powerUp: PowerUpId, questionId: number) => Promise<AckResult>;
  /** The round the extra joker could double next (null when none), and the team's joker round, which it cannot double again. */
  extraJokerOffer: PlayersStatePayload['extraJokerOffer'];
  jokerRoundId: number | null;
  onBuyExtraJoker: (roundId: number) => Promise<AckResult>;
}

/**
 * The power-ups the session offers (maxUses above 0), each card with its cost,
 * how many times this team used it and, when it can be used right now, its
 * activation button. The server decides every purchase; a refusal is shown as
 * its reason.
 */
export function PowerUpsList({
  settings,
  purchases,
  coins,
  question,
  roomReadyQuestionIds,
  onBuy,
  extraJokerOffer,
  jokerRoundId,
  onBuyExtraJoker,
}: PowerUpsListProps) {
  const offered = POWER_UP_IDS.filter(
    (powerUp) => settings[powerUp].maxUses > 0,
  );

  async function activate(powerUp: PowerUpId) {
    const result =
      powerUp === 'extra_joker' && extraJokerOffer
        ? await onBuyExtraJoker(extraJokerOffer.roundId)
        : question
          ? await onBuy(powerUp, question.id)
          : null;
    if (result && !result.success) toast.error(result.error);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm font-extrabold">
        <span className="text-foreground/55">Balance: </span>
        {coins} {coins === 1 ? 'coin' : 'coins'}
      </p>
      {offered.length === 0 && (
        <p className="text-sm text-foreground/55">No power-ups offered.</p>
      )}
      <ul className="flex flex-col gap-2.5">
        {offered.map((powerUp) => {
          const { cost, maxUses } = settings[powerUp];
          const bought = purchases.filter((p) => p.powerUp === powerUp);
          const isFree = bought.length < maxUses;
          const target =
            powerUp === 'extra_joker'
              ? extraJokerOffer !== null &&
                extraJokerOffer.roundId !== jokerRoundId &&
                !bought.some((p) => p.roundId === extraJokerOffer.roundId)
                ? `the next round: ${
                    extraJokerOffer.title === ''
                      ? `Round ${extraJokerOffer.roundNumber}`
                      : extraJokerOffer.title
                  }`
                : null
              : question !== null &&
                  powerUpApplies(powerUp, question) &&
                  !bought.some((p) => p.questionId === question.id)
                ? 'this question'
                : null;
          const isWaiting =
            powerUp === 'ask_the_room' &&
            question !== null &&
            !roomReadyQuestionIds.includes(question.id);
          return (
            <li
              key={powerUp}
              className="rounded-xl border border-foreground/15 bg-white px-4 py-3"
            >
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold">
                  {POWER_UP_LABELS[powerUp]}
                </span>
                <span className="shrink-0 text-xs font-extrabold text-foreground/45">
                  {cost} {cost === 1 ? 'coin' : 'coins'}
                </span>
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                {POWER_UP_DESCRIPTIONS[powerUp]}
              </p>
              <p className="mt-1.5 text-sm">
                <span className="font-extrabold text-foreground/55">
                  Used:{' '}
                </span>
                {bought.length} / {maxUses}
              </p>
              {isFree && target && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full"
                  aria-label={`Activate ${POWER_UP_LABELS[powerUp]}`}
                  disabled={isWaiting || coins < cost}
                  onClick={() => void activate(powerUp)}
                >
                  {isWaiting
                    ? 'Waiting for more answers'
                    : `Activate for ${target}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
