import { act, screen, waitFor, within } from '@testing-library/react';
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
  getDesktopButton,
  progress,
} from '@/app/control/__tests__/test-utils';

// The real admin hook runs here; only the socket transport is faked, so each
// test plays the server exactly as the page would see it.
const {
  mockIo,
  mockToastError,
  mockUseAuth,
  mockFetchQuizzes,
  searchParamsRef,
  routerRef,
} = vi.hoisted(() => ({
  mockIo: vi.fn(),
  mockToastError: vi.fn(),
  mockUseAuth: vi.fn(),
  mockFetchQuizzes: vi.fn(),
  searchParamsRef: { current: new URLSearchParams('code=TESTCODE') },
  routerRef: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('socket.io-client', () => ({ io: mockIo }));
vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));
vi.mock('@/app/lib/use-auth', () => ({ useAuth: mockUseAuth }));
vi.mock('@/app/lib/quiz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/lib/quiz-api')>();
  return { ...actual, fetchQuizzes: mockFetchQuizzes };
});
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsRef.current,
  useRouter: () => routerRef,
}));

const SNAPSHOT = adminView({
  joinCode: 'TESTCODE',
  progress: progress({ status: 'break' }),
  currentQuestion: null,
  teams: [{ teamId: 2, teamName: 'Beer Necessities', isConnected: false }],
});

function latestSocket(): FakeSocket {
  return mockIo.mock.results[mockIo.mock.results.length - 1]?.value;
}

async function renderLiveControl(): Promise<FakeSocket> {
  renderWithQuery(<AdminPage />);
  const socket = latestSocket();
  act(() => {
    socket.serverConnects();
    socket.trigger(SOCKET_EVENTS.STATE_SYNC, SNAPSHOT);
  });
  await screen.findByRole('complementary');
  return socket;
}

describe('AdminPage — rejected actions', () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams('code=TESTCODE');
    routerRef.push.mockReset();
    routerRef.replace.mockReset();
    mockToastError.mockReset();
    mockIo.mockReset();
    mockIo.mockImplementation(() => createFakeSocket());
    mockUseAuth.mockReturnValue(authenticatedAuthResult());
    mockFetchQuizzes.mockResolvedValue({ activeQuizId: null, quizzes: [] });
  });

  it('shows a rejected kick as a toast, not in the connection banner, and stays on the live session', async () => {
    const socket = await renderLiveControl();
    const sidebar = within(screen.getByRole('complementary'));

    const teamItem = sidebar.getByText('Beer Necessities').closest('li');
    await userEvent.click(
      within(teamItem as HTMLElement).getByRole('button', { name: /^kick$/i }),
    );
    const dialog = screen.getByRole('alertdialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: /^kick$/i }),
    );
    await act(async () =>
      socket.reject(SOCKET_EVENTS.KICK_TEAM, 'Team 2 is not in this session'),
    );

    expect(mockToastError).toHaveBeenCalledWith(
      'Team 2 is not in this session',
    );
    expect(
      screen.queryByText('Team 2 is not in this session'),
    ).not.toBeInTheDocument();
    expect(routerRef.replace).not.toHaveBeenCalledWith('/sessions');
  });

  it('shows a rejected Advance (ungraded answers) as a toast with its reason', async () => {
    const socket = await renderLiveControl();
    const reason =
      'Cannot reveal yet: 2 question(s) still have ungraded answers.';

    await userEvent.click(getDesktopButton(/^advance$/i));
    await act(async () => socket.reject(SOCKET_EVENTS.ADMIN_ACTION, reason));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(reason));
  });

  it('bounces an unknown ?code= to the session picker when it never connects', async () => {
    renderWithQuery(<AdminPage />);
    const socket = latestSocket();

    act(() => socket.trigger('connect_error', { message: 'Unknown session' }));

    await waitFor(() =>
      expect(routerRef.replace).toHaveBeenCalledWith('/sessions'),
    );
  });
});
