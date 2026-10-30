import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultPowerUpSettings,
  type PurchaseView,
} from '@campus-pubquiz/types';
import { ExtraJokerOffer } from '@/app/play/extra-joker-offer';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const settings = defaultPowerUpSettings(true).extra_joker; // 3 coins

function offer(overrides: Partial<Parameters<typeof ExtraJokerOffer>[0]> = {}) {
  const onBuy = vi.fn().mockResolvedValue({ success: true });
  render(
    <ExtraJokerOffer
      offer={{ roundId: 7, roundNumber: 2, title: 'Music' }}
      setting={settings}
      coins={5}
      purchases={[]}
      jokerRoundId={null}
      onBuy={onBuy}
      {...overrides}
    />,
  );
  return onBuy;
}

describe('ExtraJokerOffer', () => {
  it('names the round by title with the round overview on, and buys it', async () => {
    const onBuy = offer();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Double the next round: Music — 3 coins',
      }),
    );

    expect(onBuy).toHaveBeenCalledWith(7);
  });

  it('names the round by number when the title is hidden', () => {
    offer({ offer: { roundId: 7, roundNumber: 2, title: '' } });

    expect(
      screen.getByRole('button', {
        name: 'Double the next round: Round 2 — 3 coins',
      }),
    ).toBeEnabled();
  });

  it('is disabled without enough coins', () => {
    offer({ coins: 2 });

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows the refusal reason', async () => {
    const onBuy = offer();
    onBuy.mockResolvedValue({ success: false, error: 'Not enough coins' });

    await userEvent.click(screen.getByRole('button'));

    expect(toastError).toHaveBeenCalledWith('Not enough coins');
  });

  it.each([
    ['nothing is on offer', { offer: null }],
    ['the power-up is not offered', { setting: { cost: 3, maxUses: 0 } }],
    ['the round is the joker round', { jokerRoundId: 7 }],
    [
      'the round is already doubled',
      {
        purchases: [
          {
            powerUp: 'extra_joker',
            questionId: null,
            roundId: 7,
            effect: { kind: 'extra_joker' },
          },
        ] satisfies PurchaseView[],
        setting: { cost: 3, maxUses: 3 },
      },
    ],
    [
      'the limit is used up',
      {
        purchases: [
          {
            powerUp: 'extra_joker',
            questionId: null,
            roundId: 1,
            effect: { kind: 'extra_joker' },
          },
        ] satisfies PurchaseView[],
      },
    ],
  ])('offers nothing when %s', (_, overrides) => {
    offer(overrides);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
