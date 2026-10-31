import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  defaultPowerUpSettings,
  type PurchaseView,
} from '@campus-pubquiz/types';
import {
  PowerUpsList,
  type PowerUpsListProps,
} from '@/app/play/power-ups-list';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

// 3 coins
const settings = defaultPowerUpSettings(true);

function list(overrides: Partial<PowerUpsListProps> = {}) {
  const onBuyExtraJoker = vi.fn().mockResolvedValue({ success: true });
  render(
    <PowerUpsList
      settings={settings}
      purchases={[]}
      coins={5}
      question={null}
      roomReadyQuestionIds={[]}
      onBuy={vi.fn()}
      extraJokerOffer={{ roundId: 7, roundNumber: 2, title: 'Music' }}
      jokerRoundId={null}
      onBuyExtraJoker={onBuyExtraJoker}
      {...overrides}
    />,
  );
  return onBuyExtraJoker;
}

const button = () =>
  screen.queryByRole('button', { name: 'Activate Extra joker' });

describe('the extra joker card', () => {
  it('names the round by title with the round overview on, and buys it', async () => {
    const onBuy = list();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Activate Extra joker',
      }),
    );

    expect(button()).toHaveTextContent('Activate for the next round: Music');
    expect(onBuy).toHaveBeenCalledWith(7);
  });

  it('names the round by number when the title is hidden', () => {
    list({ extraJokerOffer: { roundId: 7, roundNumber: 2, title: '' } });

    expect(button()).toHaveTextContent('Activate for the next round: Round 2');
    expect(button()).toBeEnabled();
  });

  it('is disabled without enough coins', () => {
    list({ coins: 2 });

    expect(button()).toBeDisabled();
  });

  it('shows the refusal reason', async () => {
    const onBuy = list();
    onBuy.mockResolvedValue({ success: false, error: 'Not enough coins' });

    await userEvent.click(button() as HTMLElement);

    expect(toastError).toHaveBeenCalledWith('Not enough coins');
  });

  it.each([
    ['nothing is on offer', { extraJokerOffer: null }],
    [
      'the power-up is not offered',
      { settings: { ...settings, extra_joker: { cost: 3, maxUses: 0 } } },
    ],
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
        settings: { ...settings, extra_joker: { cost: 3, maxUses: 3 } },
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
  ])('has no button when %s', (_, overrides) => {
    list(overrides);

    expect(button()).toBeNull();
  });
});
