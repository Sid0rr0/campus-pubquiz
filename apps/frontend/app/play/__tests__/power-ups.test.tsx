import { screen, waitFor, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
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
  coins = 2,
  purchases = [],
  question = FRANCE,
  buyPowerUp = vi.fn().mockResolvedValue({ success: true }),
  roomReadyQuestionIds = [],
  answers = {},
  isKahoot = false,
}: {
  roomReadyQuestionIds?: number[];
  answers?: Record<number, string>;
  isKahoot?: boolean;
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
        rounds: [{ kahootMode: isKahoot, questions: [question] }],
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
      game: {
        myPurchases: purchases,
        buyPowerUp,
        roomReadyQuestionIds,
        myAnswers: answers,
      },
    }),
  );
  renderWithQuery(<PlayPage />);
  return buyPowerUp;
}

// A stamp cut off mid-flight by the test's cleanup would reject in happy-dom.
MotionGlobalConfig.skipAnimations = true;

describe('PlayPage — the power-up bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    toastError.mockClear();
  });

  it('offers a 50/50 with its cost under a multiple-choice question and buys it on a press', async () => {
    const buy = phone();

    await userEvent.click(
      screen.getByRole('button', { name: 'Activate 50/50' }),
    );

    expect(buy).toHaveBeenCalledWith('fifty_fifty', 1);
  });

  it('offers no question power-up in a kahootMode round, where a tap locks the pick', () => {
    phone({ isKahoot: true });

    expect(
      screen.queryByRole('button', { name: /^Activate/ }),
    ).not.toBeInTheDocument();
  });

  it('shows only the power-ups that apply to the question type', () => {
    phone({
      question: { type: 'closest_guess', prompt: 'How many?', points: 1 },
    });

    expect(
      screen.queryByRole('button', { name: /^Activate/ }),
    ).not.toBeInTheDocument();
  });

  it('offers the first letter and letter count on a free-text question and buys one', async () => {
    const buy = phone({
      question: { type: 'free_text', prompt: 'Name a fruit', points: 1 },
    });

    expect(
      screen.getByRole('button', { name: 'Activate Letter count' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Activate First letter' }),
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

  it('greys Ask the room out as "Waiting for more answers" until the server says it is ready', async () => {
    const buy = phone({ coins: 5 });
    const waiting = screen.getByRole('button', {
      name: 'Activate Ask the room',
    });
    expect(waiting).toBeDisabled();
    expect(waiting).toHaveTextContent('Waiting for more answers');
    await userEvent.click(waiting);
    expect(buy).not.toHaveBeenCalled();
  });

  it('lets a team buy Ask the room once the server says it is ready', async () => {
    const buy = phone({ coins: 5, roomReadyQuestionIds: [1] });

    await userEvent.click(
      screen.getByRole('button', { name: 'Activate Ask the room' }),
    );

    expect(buy).toHaveBeenCalledWith('ask_the_room', 1);
  });

  it('does not offer a 50/50 on a two-option question', () => {
    phone({ question: { ...FRANCE, options: ['Paris', 'London'] } });

    expect(screen.queryByRole('button', { name: 'Activate 50/50' })).toBeNull();
  });

  it('disables a power-up the team cannot afford', () => {
    phone({ coins: 0, settings: { powerUpsEnabled: true } });

    expect(
      screen.getByRole('button', { name: 'Activate 50/50' }),
    ).toBeDisabled();
  });

  it('hides a power-up the session does not offer', () => {
    const powerUps = defaultPowerUpSettings(false);
    powerUps.fifty_fifty = { cost: 1, maxUses: 0 };
    powerUps.ask_the_room = { cost: 2, maxUses: 0 };
    phone({ settings: { powerUpsEnabled: true, powerUps } });

    expect(
      screen.queryByRole('button', { name: /^Activate/ }),
    ).not.toBeInTheDocument();
  });

  it('shows no bar in a session without power-ups for a team with no coin', () => {
    phone({ settings: { powerUpsEnabled: false }, coins: 0 });

    expect(
      screen.queryByRole('button', { name: /^Activate/ }),
    ).not.toBeInTheDocument();
  });

  it('keeps a bought 50/50 in effect once a carried coin is spent in a session without power-ups', () => {
    phone({
      settings: { powerUpsEnabled: false },
      coins: 0,
      purchases: [fiftyFifty],
    });

    expect(screen.getByRole('button', { name: 'London' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Berlin' })).toBeDisabled();
  });

  it('shows the bar in a session without power-ups for a team with a carried coin', () => {
    phone({ settings: { powerUpsEnabled: false }, coins: 1 });

    expect(
      screen.getAllByRole('button', { name: /^Activate/ }).length,
    ).toBeGreaterThan(0);
  });

  it('says why when the server refuses the purchase', async () => {
    phone({
      buyPowerUp: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Not enough coins' }),
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Activate 50/50' }),
    );

    expect(toastError).toHaveBeenCalledWith('Not enough coins');
  });

  it('tells the team its doubled margin after a wider margin, as after a reconnect', () => {
    const NUMBER = {
      type: 'number',
      prompt: 'How many bones?',
      points: 3,
      margin: { value: 5, unit: 'percent' },
    };
    phone({
      question: NUMBER,
      purchases: [
        {
          powerUp: 'wider_margin',
          questionId: 1,
          roundId: null,
          effect: { kind: 'wider_margin' },
        },
      ],
      coins: 0,
    });

    expect(
      screen.getByText(
        'Answers within 10% of the real number count as correct',
      ),
    ).toBeInTheDocument();
  });

  describe('a wider margin and an answer already given', () => {
    const NUMBER = {
      type: 'number',
      prompt: 'How many bones?',
      points: 3,
      margin: { value: 5, unit: 'percent' },
    };
    const widerMargin: PurchaseView = {
      powerUp: 'wider_margin',
      questionId: 1,
      roundId: null,
      effect: { kind: 'wider_margin' },
    };
    it('asks for no second submit: the server grades the answer already given', () => {
      phone({
        question: NUMBER,
        purchases: [widerMargin],
        answers: { 1: '206' },
        coins: 0,
      });

      expect(screen.queryByText(/Submit again/)).toBeNull();
    });
  });

  describe('a pin and an answer already given', () => {
    const SORT = {
      type: 'sort',
      prompt: 'Order these',
      options: ['A', 'B', 'C'],
      points: 3,
    };
    const pin: PurchaseView = {
      powerUp: 'pin_one',
      questionId: 1,
      roundId: null,
      effect: { kind: 'pin_one', item: 'A', position: 0 },
    };
    const RESUBMIT = /Submit again to send the pinned order/;

    it('tells the team to submit again when the answer given has the item off its place', () => {
      phone({
        question: SORT,
        purchases: [pin],
        answers: { 1: 'B|A|C' },
        coins: 0,
      });

      expect(screen.getByText(RESUBMIT)).toBeInTheDocument();
    });

    it('says nothing when the answer given already has the item in place', () => {
      phone({
        question: SORT,
        purchases: [pin],
        answers: { 1: 'A|B|C' },
        coins: 0,
      });

      expect(screen.queryByText(RESUBMIT)).toBeNull();
    });
  });

  it('shows the room split with the 50/50-removed options crossed out', () => {
    phone({
      purchases: [
        fiftyFifty,
        {
          powerUp: 'ask_the_room',
          questionId: 1,
          roundId: null,
          effect: {
            kind: 'ask_the_room',
            split: { Paris: 60, London: 20, Berlin: 0, Rome: 20 },
          },
        },
      ],
      coins: 5,
    });

    const room = within(screen.getByTestId('room-split'));
    expect(room.getByText('Paris').closest('li')).toHaveTextContent('60%');
    expect(room.getByText('London').tagName).toBe('S');
    expect(room.getByText('London').closest('li')).toHaveTextContent('20%');
    expect(room.getByText('Rome').tagName).not.toBe('S');
    expect(screen.queryByRole('button', { name: /Ask the room/ })).toBeNull();
  });

  it('greys out the removed options and hides the used power-up, as after a reconnect', () => {
    phone({ purchases: [fiftyFifty], coins: 0 });

    expect(screen.getByRole('button', { name: 'Paris' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rome' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'London' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Berlin' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Activate 50/50' })).toBeNull();
  });

  it('lists the offered power-ups with their cost and uses in a panel, and in the mobile drawer', async () => {
    phone({
      purchases: [fiftyFifty],
      settings: {
        powerUpsEnabled: true,
        powerUps: {
          ...defaultPowerUpSettings(false),
          fifty_fifty: { cost: 1, maxUses: 2 },
          pin_one: { cost: 2, maxUses: 0 },
        },
      },
    });

    const panel = screen.getByRole('heading', { name: 'Power-ups' })
      .parentElement as HTMLElement;
    const fifty = within(panel).getByText('50/50').closest('li') as HTMLElement;
    expect(fifty).toHaveTextContent('1 coin');
    expect(fifty).toHaveTextContent('Removes half the options');
    expect(fifty).toHaveTextContent('Used: 1 / 2');
    expect(within(panel).queryByText('Pin one')).toBeNull();

    await userEvent.click(
      screen.getByRole('button', { name: /^Power-ups \(/ }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Used: 1 / 2');
  });

  it('shows no power-ups list when the session has none and the team has no coins', () => {
    phone({ settings: { powerUpsEnabled: false }, coins: 0 });

    expect(screen.queryByRole('heading', { name: 'Power-ups' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Power-ups/ })).toBeNull();
  });

  it('shows the balance and the activation buttons in the power-ups panel and drawer, not under the question', async () => {
    const buy = phone({ coins: 3 });

    const panel = screen.getByRole('heading', { name: 'Power-ups' })
      .parentElement as HTMLElement;
    expect(panel).toHaveTextContent('Balance: 3 coins');
    expect(
      within(panel).getByRole('button', { name: 'Activate 50/50' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Activate 50/50' }),
    ).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: /^Power-ups \(/ }),
    );
    const drawer = screen.getByRole('dialog');
    expect(drawer).toHaveTextContent('Balance: 3 coins');
    await userEvent.click(
      within(drawer).getByRole('button', { name: 'Activate 50/50' }),
    );
    expect(buy).toHaveBeenCalledWith('fifty_fifty', 1);
  });

  it('stamps the power-up and its cost once the server accepted it, not on a refusal', async () => {
    const buy = phone({ coins: 3 });
    const activate = () =>
      userEvent.click(screen.getByRole('button', { name: 'Activate 50/50' }));

    buy.mockResolvedValueOnce({ success: false, error: 'Not enough coins' });
    await activate();
    expect(screen.queryByText('−2 coins')).toBeNull();

    buy.mockResolvedValueOnce({ success: true });
    await activate();
    expect(await screen.findByText('−2 coins')).toBeInTheDocument();
  });

  it('plays no stamp for a purchase already made when the phone loads', () => {
    phone({ purchases: [fiftyFifty] });

    expect(screen.queryByText('−2 coins')).toBeNull();
  });

  it('closes the drawer once the purchase went through, and keeps it open on a refusal', async () => {
    const buy = phone({ coins: 3 });
    const activate = () =>
      userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Activate 50/50',
        }),
      );
    await userEvent.click(
      screen.getByRole('button', { name: /^Power-ups \(/ }),
    );

    buy.mockResolvedValueOnce({ success: false, error: 'Not enough coins' });
    await activate();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    buy.mockResolvedValueOnce({ success: true });
    await activate();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
