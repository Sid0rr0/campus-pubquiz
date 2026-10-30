import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultPowerUpSettings,
  type PurchaseView,
  type SessionSettings,
} from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import { teamLinkResult } from './test-utils';

const { mockUseTeamLink, searchParamsRef } = vi.hoisted(() => ({
  mockUseTeamLink: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock('@/app/lib/use-team-link', () => ({
  useTeamLink: mockUseTeamLink,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const FRANCE = {
  type: 'multiple_choice',
  prompt: 'Capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Rome'],
  points: 2,
} as const;

const fiftyFifty: PurchaseView = {
  powerUp: 'fifty_fifty',
  questionId: 1,
  roundId: null,
  effect: { kind: 'fifty_fifty', removedOptions: ['London', 'Berlin'] },
};

function phone({
  settings = { powerUpsEnabled: true },
  coins = 1,
  purchases = [],
  question = FRANCE,
  buyPowerUp = vi.fn().mockResolvedValue({ success: true }),
}: {
  settings?: Partial<SessionSettings>;
  coins?: number;
  purchases?: PurchaseView[];
  question?: Record<string, unknown>;
  buyPowerUp?: ReturnType<typeof vi.fn>;
} = {}) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'Returning Team');
  mockUseTeamLink.mockReturnValue(
    teamLinkResult({
      session: {
        rounds: [{ questions: [question] }],
        progress: { status: 'question_open' },
        settings: { powerUps: defaultPowerUpSettings(false), ...settings },
      } as never,
      join: {
        team: {
          teamId: 'team-1',
          teamName: 'Returning Team',
          teamToken: 'team-token-1',
          coins,
        },
      },
      game: { myPurchases: purchases, buyPowerUp },
    }),
  );
  renderWithQuery(<PlayPage />);
  return buyPowerUp;
}

describe('PlayPage — the power-up bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    toastError.mockClear();
  });

  it('offers a 50/50 with its cost under a multiple-choice question and buys it on a press', async () => {
    const buy = phone();

    await userEvent.click(screen.getByRole('button', { name: /50\/50 · 1/ }));

    expect(buy).toHaveBeenCalledWith('fifty_fifty', 1);
  });

  it('shows only the power-ups that apply to the question type', () => {
    phone({
      question: { type: 'number', prompt: 'How many?', points: 1 },
    });

    expect(screen.queryByTestId('power-up-bar')).not.toBeInTheDocument();
  });

  it('offers the first letter and letter count on a free-text question and buys one', async () => {
    const buy = phone({
      question: { type: 'free_text', prompt: 'Name a fruit', points: 1 },
    });

    expect(
      screen.getByRole('button', { name: /Letter count · 1/ }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /First letter · 1/ }),
    );

    expect(buy).toHaveBeenCalledWith('first_letter', 1);
  });

  it('shows the stored hints on the question, as after a reconnect', () => {
    phone({
      question: { type: 'free_text', prompt: 'Name a fruit', points: 1 },
      coins: 0,
      purchases: [
        {
          powerUp: 'first_letter',
          questionId: 1,
          roundId: null,
          effect: { kind: 'first_letter', hint: 'B' },
        },
        {
          powerUp: 'letter_count',
          questionId: 1,
          roundId: null,
          effect: { kind: 'letter_count', hint: '______' },
        },
      ],
    });

    expect(screen.getByText('First letter: B')).toBeInTheDocument();
    expect(screen.getByText('Letter count: ______')).toBeInTheDocument();
  });

  it('does not offer a 50/50 on a two-option question', () => {
    phone({ question: { ...FRANCE, options: ['Paris', 'London'] } });

    expect(screen.queryByTestId('power-up-bar')).not.toBeInTheDocument();
  });

  it('disables a power-up the team cannot afford', () => {
    phone({ coins: 0, settings: { powerUpsEnabled: true } });

    expect(screen.getByRole('button', { name: /50\/50/ })).toBeDisabled();
  });

  it('hides a power-up the session does not offer', () => {
    const powerUps = defaultPowerUpSettings(false);
    powerUps.fifty_fifty = { cost: 1, maxUses: 0 };
    phone({ settings: { powerUpsEnabled: true, powerUps } });

    expect(screen.queryByTestId('power-up-bar')).not.toBeInTheDocument();
  });

  it('shows no bar in a session without power-ups for a team with no coin', () => {
    phone({ settings: { powerUpsEnabled: false }, coins: 0 });

    expect(screen.queryByTestId('power-up-bar')).not.toBeInTheDocument();
  });

  it('shows the bar in a session without power-ups for a team with a carried coin', () => {
    phone({ settings: { powerUpsEnabled: false }, coins: 1 });

    expect(screen.getByTestId('power-up-bar')).toBeInTheDocument();
  });

  it('says why when the server refuses the purchase', async () => {
    phone({
      buyPowerUp: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Not enough coins' }),
    });

    await userEvent.click(screen.getByRole('button', { name: /50\/50/ }));

    expect(toastError).toHaveBeenCalledWith('Not enough coins');
  });

  it('hides the removed options and the used power-up, as after a reconnect', () => {
    phone({ purchases: [fiftyFifty], coins: 0 });

    expect(screen.getByRole('button', { name: 'Paris' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rome' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'London' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Berlin' })).toBeNull();
    expect(screen.queryByTestId('power-up-bar')).not.toBeInTheDocument();
  });
});
