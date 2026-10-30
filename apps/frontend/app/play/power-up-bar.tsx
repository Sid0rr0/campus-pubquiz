import { toast } from 'sonner';
import {
  POWER_UP_IDS,
  POWER_UP_LABELS,
  optionsAfterPurchases,
  powerUpApplies,
  type AckResult,
  type PowerUpId,
  type PowerUpSettings,
  type PurchaseView,
  type QuestionView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

/** What the phone needs to offer power-ups on a question. */
export interface PowerUpShop {
  settings: PowerUpSettings;
  coins: number;
  purchases: PurchaseView[];
  onBuy: (powerUp: PowerUpId, questionId: number) => Promise<AckResult>;
}

/** The split Ask the room stored for the question, each option with its share; options this team's 50/50 removed are crossed out. */
export function RoomSplit({
  question,
  purchases,
}: {
  question: QuestionView;
  purchases: PurchaseView[];
}) {
  const bought = purchases.find(
    (p) => p.questionId === question.id && p.effect.kind === 'ask_the_room',
  );
  if (bought?.effect.kind !== 'ask_the_room' || !question.options) return null;
  const { split } = bought.effect;
  const left = optionsAfterPurchases(question.id, question.options, purchases);
  return (
    <div data-testid="room-split" className="text-center text-sm">
      <p className="font-semibold">Ask the room</p>
      <ul>
        {question.options.map((option) => (
          <li key={option}>
            {left.includes(option) ? <span>{option}</span> : <s>{option}</s>}{' '}
            {split[option] ?? 0}%
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The power-ups under the question: only those that work on its type, are
 * offered by the session, and the team may still use on it. The server decides
 * every purchase; a refusal is shown as its reason.
 */
export function PowerUpBar({
  question,
  shop,
}: {
  question: QuestionView;
  shop: PowerUpShop;
}) {
  const offered = POWER_UP_IDS.filter((powerUp) => {
    const { maxUses } = shop.settings[powerUp];
    const bought = shop.purchases.filter((p) => p.powerUp === powerUp);
    return (
      maxUses > 0 &&
      powerUpApplies(powerUp, question) &&
      bought.length < maxUses &&
      !bought.some((p) => p.questionId === question.id)
    );
  });
  if (offered.length === 0) return null;

  async function buy(powerUp: PowerUpId) {
    const result = await shop.onBuy(powerUp, question.id);
    if (!result.success) toast.error(result.error);
  }

  return (
    <div
      data-testid="power-up-bar"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {offered.map((powerUp) => {
        const { cost } = shop.settings[powerUp];
        return (
          <Button
            key={powerUp}
            type="button"
            variant="outline"
            size="sm"
            disabled={shop.coins < cost}
            onClick={() => void buy(powerUp)}
          >
            {POWER_UP_LABELS[powerUp]} · {cost} 🪙
          </Button>
        );
      })}
    </div>
  );
}
