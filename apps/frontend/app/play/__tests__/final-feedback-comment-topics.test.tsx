import { act, screen } from '@testing-library/react';
import { renderWithQuery } from '@/test-utils/query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamFeedbackView } from '@campus-pubquiz/types';
import PlayPage from '@/app/play/page';
import { socketResult } from './test-utils';

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

function endedSession(isFeedbackCollected: boolean) {
  return {
    rounds: [{ title: 'Music', questions: [{}] }],
    progress: { status: 'ended' as const },
    settings: { collectFeedback: isFeedbackCollected },
  };
}

const MAX_TOPICS = 10;

interface EndedOverrides {
  isFeedbackCollected?: boolean;
  myFeedback?: TeamFeedbackView;
  sendFeedback?: ReturnType<typeof vi.fn>;
  roundRatingsEpoch?: number;
}

function endedHook(overrides: EndedOverrides) {
  return socketResult({
    session: endedSession(overrides.isFeedbackCollected ?? true),
    team: { teamId: 7, teamName: 'The Quizzards', teamToken: 'token-7' },
    myFeedback: overrides.myFeedback ?? { comment: '', topics: [] },
    sendFeedback: overrides.sendFeedback,
    roundRatingsEpoch: overrides.roundRatingsEpoch ?? 0,
  });
}

function renderEnded(overrides: EndedOverrides = {}) {
  window.localStorage.setItem('campus-pubquiz-team-name', 'The Quizzards');
  const sendFeedback =
    overrides.sendFeedback ?? vi.fn().mockResolvedValue({ success: true });
  mockUseTeamLink.mockReturnValue(endedHook({ ...overrides, sendFeedback }));
  const { rerender } = renderWithQuery(<PlayPage />);
  /** A join payload arriving: a new epoch and a fresh saved-feedback object, as the hook produces. */
  function receiveJoinPayload(myFeedback: TeamFeedbackView, epoch: number) {
    mockUseTeamLink.mockReturnValue(
      endedHook({
        ...overrides,
        sendFeedback,
        myFeedback,
        roundRatingsEpoch: epoch,
      }),
    );
    rerender(<PlayPage />);
  }
  return { sendFeedback, receiveJoinPayload };
}

const comment = () => screen.getByRole('textbox', { name: 'Anything else?' });
const topicLines = () => screen.queryAllByRole('textbox', { name: /^Topic / });
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const addButton = () => screen.getByRole('button', { name: '+ Add another' });

describe('PlayPage — the comment and topic suggestions on the final form', () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParamsRef.current = new URLSearchParams();
    mockUseTeamLink.mockReturnValue(socketResult());
  });

  it('sends the comment and topics together and shows "Sent ✓" once acknowledged', async () => {
    const user = userEvent.setup();
    const { sendFeedback } = renderEnded();
    expect(screen.queryByText('Sent ✓')).not.toBeInTheDocument();

    await user.type(comment(), 'Great night');
    await user.type(topicLines()[0], 'Geography');
    await user.click(sendButton());

    expect(sendFeedback).toHaveBeenCalledWith({
      comment: 'Great night',
      topics: ['Geography'],
    });
    expect(await screen.findByText('Sent ✓')).toBeInTheDocument();
  });

  it('adds a topic line per "+ Add another" and stops at 10', async () => {
    const user = userEvent.setup();
    renderEnded();
    expect(topicLines()).toHaveLength(1);

    for (let i = 1; i < MAX_TOPICS; i += 1) {
      await user.click(addButton());
    }

    expect(topicLines()).toHaveLength(MAX_TOPICS);
    expect(addButton()).toBeDisabled();
    expect(screen.getByText(/up to 10 topics/i)).toBeInTheDocument();
  });

  it('trims topics and drops empty and whitespace-only lines from what it sends', async () => {
    const user = userEvent.setup();
    const { sendFeedback } = renderEnded();
    await user.click(addButton());
    await user.click(addButton());
    await user.type(topicLines()[0], '  Geography ');
    await user.type(topicLines()[1], '   ');

    await user.click(sendButton());

    expect(sendFeedback).toHaveBeenCalledWith({
      comment: '',
      topics: ['Geography'],
    });
  });

  it('clears "Sent ✓" on an edit, and sending again sends the new text', async () => {
    const user = userEvent.setup();
    const { sendFeedback } = renderEnded();
    await user.type(comment(), 'Great');
    await user.click(sendButton());
    expect(await screen.findByText('Sent ✓')).toBeInTheDocument();

    await user.type(comment(), '!');
    expect(screen.queryByText('Sent ✓')).not.toBeInTheDocument();
    await user.click(sendButton());

    expect(sendFeedback).toHaveBeenLastCalledWith({
      comment: 'Great!',
      topics: [],
    });
    expect(await screen.findByText('Sent ✓')).toBeInTheDocument();
  });

  it('says what is wrong with a comment over 1000 characters and does not send it', async () => {
    const user = userEvent.setup();
    const { sendFeedback } = renderEnded();

    await user.click(comment());
    await user.paste('x'.repeat(1001));

    expect(screen.getByRole('alert')).toHaveTextContent(/1000 characters/i);
    expect(sendButton()).toBeDisabled();
    await user.click(sendButton());
    expect(sendFeedback).not.toHaveBeenCalled();
  });

  it('says which topic is over 60 characters and does not send it', async () => {
    const user = userEvent.setup();
    const { sendFeedback } = renderEnded();

    await user.click(topicLines()[0]);
    await user.paste('x'.repeat(61));

    expect(screen.getByRole('alert')).toHaveTextContent(
      /topic 1.*60 characters/i,
    );
    expect(sendButton()).toBeDisabled();
    await user.click(sendButton());
    expect(sendFeedback).not.toHaveBeenCalled();
  });

  it('is filled in from what the server holds, already marked "Sent ✓"', () => {
    renderEnded({
      myFeedback: { comment: 'Loved it', topics: ['Geography', 'Space'] },
    });

    expect(comment()).toHaveValue('Loved it');
    expect(
      topicLines().map((line) => (line as HTMLInputElement).value),
    ).toEqual(['Geography', 'Space']);
    expect(screen.getByText('Sent ✓')).toBeInTheDocument();
  });

  it('shows the refusal and no "Sent ✓" when the server says no', async () => {
    const user = userEvent.setup();
    renderEnded({
      sendFeedback: vi
        .fn()
        .mockResolvedValue({ success: false, error: 'Not open' }),
    });
    await user.type(comment(), 'Hello');

    await user.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not sent.*try again/i,
    );
    expect(screen.queryByText('Sent ✓')).not.toBeInTheDocument();
  });

  it('keeps an unsent draft when a reconnect brings a new join payload', async () => {
    const user = userEvent.setup();
    const { receiveJoinPayload } = renderEnded();
    await user.type(comment(), 'Half-typed thoughts');
    await user.type(topicLines()[0], 'Space');

    receiveJoinPayload({ comment: '', topics: [] }, 1);

    expect(comment()).toHaveValue('Half-typed thoughts');
    expect(topicLines()[0]).toHaveValue('Space');
  });

  it('fills in from a join payload that arrives after the form appeared, when nothing has been typed', () => {
    const { receiveJoinPayload } = renderEnded();
    expect(comment()).toHaveValue('');

    receiveJoinPayload({ comment: 'Loved it', topics: ['Geography'] }, 1);

    expect(comment()).toHaveValue('Loved it');
    expect(topicLines()[0]).toHaveValue('Geography');
    expect(screen.getByText('Sent ✓')).toBeInTheDocument();
  });

  it('does not show "Sent ✓" for text edited while the send was in flight', async () => {
    const user = userEvent.setup();
    let acknowledge!: (result: { success: true }) => void;
    const sendFeedback = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
    );
    renderEnded({ sendFeedback });
    await user.type(comment(), 'Great');
    await user.click(sendButton());

    await user.type(comment(), '!');
    await act(async () => acknowledge({ success: true }));

    expect(comment()).toHaveValue('Great!');
    expect(screen.queryByText('Sent ✓')).not.toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it('shows no comment box while the session does not collect feedback', () => {
    renderEnded({ isFeedbackCollected: false });

    expect(
      screen.queryByRole('textbox', { name: 'Anything else?' }),
    ).not.toBeInTheDocument();
  });
});
