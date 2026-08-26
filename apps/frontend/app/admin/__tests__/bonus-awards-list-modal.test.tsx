import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BonusAwardsListedPayload } from '@campus-pubquiz/types';
import { BonusAwardsListModal } from '@/app/admin/bonus-awards-list-modal';
import { renderWithQuery } from '@/test-utils/query';

const { mockFetchBonusAwards, mockUpdateBonusAward, mockDeleteBonusAward } =
  vi.hoisted(() => ({
    mockFetchBonusAwards: vi.fn(),
    mockUpdateBonusAward: vi.fn(),
    mockDeleteBonusAward: vi.fn(),
  }));

vi.mock('@/app/lib/bonus-award-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/lib/bonus-award-api')>();
  return {
    ...actual,
    fetchBonusAwards: mockFetchBonusAwards,
    updateBonusAward: mockUpdateBonusAward,
    deleteBonusAward: mockDeleteBonusAward,
  };
});

const JOIN_CODE = 'ABCDEF';

const AWARDS: BonusAwardsListedPayload = {
  teamId: 1,
  awards: [
    { id: 9, category: 'shot', points: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    {
      id: 10,
      category: 'custom',
      points: 3,
      reason: 'Best team name',
      createdAt: '2026-01-01T00:01:00.000Z',
    },
  ],
};

function renderModal() {
  return renderWithQuery(
    <>
      <BonusAwardsListModal
        joinCode={JOIN_CODE}
        teamId={1}
        teamName="The Quizzards"
        onOpenChange={vi.fn()}
      />
      <Toaster />
    </>,
  );
}

describe('BonusAwardsListModal', () => {
  beforeEach(() => {
    mockFetchBonusAwards.mockReset();
    mockUpdateBonusAward.mockReset();
    mockDeleteBonusAward.mockReset();
    mockFetchBonusAwards.mockResolvedValue(AWARDS);
    mockUpdateBonusAward.mockResolvedValue(AWARDS.awards[0]);
    mockDeleteBonusAward.mockResolvedValue(undefined);
  });

  it("lists every award for the team, showing each one's category, points, and reason", async () => {
    renderModal();

    expect(await screen.findByText(/shot/i)).toBeInTheDocument();
    expect(screen.getByText(/custom/i)).toBeInTheDocument();
    expect(screen.getByText('Best team name')).toBeInTheDocument();
    expect(mockFetchBonusAwards).toHaveBeenCalledWith(JOIN_CODE, 1);
  });

  it('shows an empty state when the team has no bonus awards yet', async () => {
    mockFetchBonusAwards.mockResolvedValue({ teamId: 1, awards: [] });
    renderModal();

    expect(
      await screen.findByText(/no bonus awards yet/i),
    ).toBeInTheDocument();
  });

  it('submits an edited points value for a predefined-category award', async () => {
    renderModal();
    await screen.findByText(/shot/i);

    await userEvent.click(
      screen.getByRole('button', { name: /edit shot award/i }),
    );
    const pointsInput = screen.getByLabelText(/points for shot award/i);
    await userEvent.clear(pointsInput);
    await userEvent.type(pointsInput, '2');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdateBonusAward).toHaveBeenCalledWith(
      JOIN_CODE,
      9,
      2,
      undefined,
    );
  });

  it('submits an edited reason for a custom-category award', async () => {
    renderModal();
    await screen.findByText(/custom/i);

    await userEvent.click(
      screen.getByRole('button', { name: /edit custom award/i }),
    );
    const reasonInput = screen.getByLabelText(/bonus reason/i);
    await userEvent.clear(reasonInput);
    await userEvent.type(reasonInput, 'Funniest answer');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockUpdateBonusAward).toHaveBeenCalledWith(
      JOIN_CODE,
      10,
      3,
      'Funniest answer',
    );
  });

  it('disables saving a custom-category award while the reason is blank', async () => {
    renderModal();
    await screen.findByText(/custom/i);

    await userEvent.click(
      screen.getByRole('button', { name: /edit custom award/i }),
    );
    const reasonInput = screen.getByLabelText(/bonus reason/i);
    await userEvent.clear(reasonInput);

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(mockUpdateBonusAward).not.toHaveBeenCalled();
  });

  it('requires confirmation before deleting an award', async () => {
    renderModal();
    await screen.findByText(/shot/i);

    await userEvent.click(
      screen.getByRole('button', { name: /delete shot award/i }),
    );
    expect(mockDeleteBonusAward).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(mockDeleteBonusAward).toHaveBeenCalledWith(JOIN_CODE, 9);
  });

  it('shows a toast when updating an award fails', async () => {
    const { BonusAwardApiError } = await import('@/app/lib/bonus-award-api');
    mockUpdateBonusAward.mockRejectedValue(
      new BonusAwardApiError('Could not update bonus award', 400),
    );
    renderModal();
    await screen.findByText(/shot/i);

    await userEvent.click(
      screen.getByRole('button', { name: /edit shot award/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(
      await screen.findByText(/could not update bonus award/i),
    ).toBeInTheDocument();
  });
});
