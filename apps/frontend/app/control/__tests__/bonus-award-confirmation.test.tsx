import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS } from '@campus-pubquiz/types';
import AdminPage from '@/app/control/page';
import { renderWithQuery } from '@/test-utils/query';
import {
  createFakeSocket,
  type FakeSocket,
} from '@/app/lib/__tests__/fake-socket';
import {
  adminView,
  authenticatedAuthResult,
  progress,
} from '@/app/control/__tests__/test-utils';

// The real admin hook runs here; only the socket transport is faked, so each
// test plays the server exactly as the page would see it.
const {
  mockIo,
  mockToast,
  mockToastSuccess,
  mockToastError,
  mockUseAuth,
  mockFetchQuizzes,
} = vi.hoisted(() => ({
  mockIo: vi.fn(),
  mockToast: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockUseAuth: vi.fn(),
  mockFetchQuizzes: vi.fn(),
}));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('sonner', () => ({
  toast: Object.assign(mockToast, {
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));
vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));
vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('code=TESTCODE'),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const TEAM_NAME = 'The Quizzly Bears';

const SNAPSHOT = adminView({
  joinCode: 'TESTCODE',
  progress: progress({ status: 'break' }),
  currentQuestion: null,
  // The team's phone is offline: the confirmation must not depend on it.
  teams: [{ teamId: 7, teamName: TEAM_NAME, isConnected: false }],
  leaderboard: [
    {
      teamId: 7,
      teamName: TEAM_NAME,
      totalPoints: 0,
      rank: 1,
      rankTo: 1,
      bonusPoints: 0,
      positiveBonusPoints: 0,
      negativeBonusPoints: 0,
      roundPoints: [],
    },
  ],
});

async function renderLiveControl(): Promise<FakeSocket> {
  renderWithQuery(<AdminPage />);
  const socket = mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
  act(() => {
    socket.serverConnects();
    socket.trigger(SOCKET_EVENTS.STATE_SYNC, SNAPSHOT);
  });
  await screen.findByRole('complementary');
  return socket;
}

async function openAwardDialog(): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole('button', { name: `Actions for ${TEAM_NAME}` }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: /award bonus/i }),
  );
  return screen.findByRole('dialog', { name: /award bonus/i });
}

describe('AdminPage — bonus award confirmation', () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('confirms an accepted bonus with the signed points, category and team', async () => {
    const socket = await renderLiveControl();
    const dialog = await openAwardDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: /^selfie$/i }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^award$/i }),
    );
    await act(async () => socket.acknowledge(SOCKET_EVENTS.AWARD_BONUS));

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(`+1 Selfie → ${TEAM_NAME}`);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('confirms an accepted penalty with the negative points', async () => {
    const socket = await renderLiveControl();
    const dialog = await openAwardDialog();

    await userEvent.click(
      within(dialog).getByRole('button', { name: /^custom$/i }),
    );
    await userEvent.type(
      within(dialog).getByLabelText('Bonus reason'),
      'phone use',
    );
    const points = within(dialog).getByLabelText('Bonus points');
    await userEvent.clear(points);
    await userEvent.type(points, '-1');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^award$/i }),
    );
    await act(async () => socket.acknowledge(SOCKET_EVENTS.AWARD_BONUS));

    expect(mockToastSuccess).toHaveBeenCalledWith(`−1 Custom → ${TEAM_NAME}`);
  });

  it('keeps the dialog open and raises only the error toast when the award is refused', async () => {
    const socket = await renderLiveControl();
    const dialog = await openAwardDialog();
    const reason = 'Bonus awards are closed';

    await userEvent.click(
      within(dialog).getByRole('button', { name: /^selfie$/i }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^award$/i }),
    );
    await act(async () => socket.reject(SOCKET_EVENTS.AWARD_BONUS, reason));

    expect(mockToastError).toHaveBeenCalledWith(reason);
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: /award bonus/i }),
    ).toBeInTheDocument();
  });
});
