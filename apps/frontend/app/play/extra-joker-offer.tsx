import { toast } from 'sonner';
import type {
  AckResult,
  PlayersStatePayload,
  PowerUpSetting,
  PurchaseView,
} from '@campus-pubquiz/types';
import { Button } from '@/app/components/button';

/**
 * The extra joker on offer between and during rounds: "Double the next round".
 * The server names the round on offer and decides every purchase; this only
 * hides the offer when the team could not buy it anyway.
 */
export function ExtraJokerOffer({
  offer,
  setting,
  coins,
  purchases,
  jokerRoundId,
  onBuy,
}: {
  offer: PlayersStatePayload['extraJokerOffer'];
  setting: PowerUpSetting;
  coins: number;
  purchases: PurchaseView[];
  /** The team's joker round, which an extra joker cannot double again. */
  jokerRoundId: number | null;
  onBuy: (roundId: number) => Promise<AckResult>;
}) {
  const bought = purchases.filter((p) => p.powerUp === 'extra_joker');
  if (
    offer === null ||
    setting.maxUses === 0 ||
    bought.length >= setting.maxUses ||
    offer.roundId === jokerRoundId ||
    bought.some((p) => p.roundId === offer.roundId)
  ) {
    return null;
  }

  async function buy(roundId: number) {
    const result = await onBuy(roundId);
    if (!result.success) toast.error(result.error);
  }

  const round = offer.title === '' ? `Round ${offer.roundNumber}` : offer.title;
  return (
    <div data-testid="extra-joker-offer" className="mb-4 flex justify-center">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={coins < setting.cost}
        onClick={() => void buy(offer.roundId)}
      >
        {`Double the next round: ${round} — ${setting.cost} ${
          setting.cost === 1 ? 'coin' : 'coins'
        }`}
      </Button>
    </div>
  );
}
