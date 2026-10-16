import { expect, type Page } from '@playwright/test';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The big screen: `/display` for one session. Reads what the room would see. */
export class DisplayScreen {
  constructor(
    readonly page: Page,
    private readonly joinCode: string,
  ) {}

  async open(): Promise<void> {
    await this.page.goto(`/display?code=${this.joinCode}`);
    await expect(
      this.page.getByRole('heading', {
        name: 'Waiting for the teams to join…',
      }),
    ).toBeVisible();
  }

  /** The big screen has lost its connection: it keeps the pinned session on air and shows a reconnecting pill. */
  async expectReconnecting(): Promise<void> {
    await expect(
      this.page.getByRole('status').filter({ hasText: 'Reconnecting…' }),
    ).toBeVisible();
  }

  /** The lobby counts and lists exactly these teams (the roster repeats names for its marquee, so the first is checked). */
  async expectLobbyTeams(teamNames: readonly string[]): Promise<void> {
    const label = teamNames.length === 1 ? 'TEAM' : 'TEAMS';
    await expect(
      this.page.getByText(`${teamNames.length} ${label} JOINED`),
    ).toBeVisible();
    for (const teamName of teamNames) {
      await expect(
        this.page.getByText(teamName, { exact: true }).first(),
      ).toBeVisible();
    }
  }

  /** A text shown on the screen, such as a house rule. */
  async expectText(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  /** The question (or its reveal) on air. */
  async expectQuestion(prompt: string): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: prompt }),
    ).toBeVisible();
  }

  async expectAnsweredCount(
    answered: number,
    teamCount: number,
  ): Promise<void> {
    await expect(
      this.page.getByText(`${answered} OF ${teamCount} TEAMS ANSWERED`),
    ).toBeVisible();
  }

  /** The question on air counts `teamCount` teams in the room, however many have answered. */
  async expectTeamCount(teamCount: number): Promise<void> {
    await expect(
      this.page.getByText(`OF ${teamCount} TEAMS ANSWERED`),
    ).toBeVisible();
  }

  async expectAudioPlayer(src: string): Promise<void> {
    await expect(this.page.locator('audio')).toHaveAttribute('src', src);
  }

  /** The locking countdown (the E2E grace period is only a couple of seconds, so it is already in its final warning). */
  async expectLockCountdown(): Promise<void> {
    await expect(
      this.page.getByTestId('question-lock-countdown'),
    ).toBeVisible();
  }

  /** The revealed answer on the question on air. */
  async expectRevealedAnswer(answer: string): Promise<void> {
    await expect(this.page.getByText(`Answer: ${answer}`)).toBeVisible();
  }

  async expectBreak(breakNumber: number): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: `BREAK ${breakNumber}` }),
    ).toBeVisible();
  }

  /** The team's row on the leaderboard shows `points`. */
  async expectLeaderboardRow(teamName: string, points: number): Promise<void> {
    const row = this.page
      .getByTestId('leaderboard-rows')
      .getByRole('listitem')
      .filter({ hasText: teamName });
    await expect(row).toHaveText(
      new RegExp(`${escapeRegExp(teamName)}\\s*${points}$`),
    );
  }
}
