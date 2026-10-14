import { expect, type Locator, type Page } from '@playwright/test';

/** The Advance slot's label depends on the status (and on the leaderboard); this matches every one. */
const ADVANCE_SLOT_LABEL =
  /^(Advance|Begin Quiz|Continue|Start Round|Show Next Team|Hide Leaderboard|Hide Join Overlay)$/;

export type GradeSize = '0 points' | 'half points' | 'full points';

/** The quiz master's laptop: `/control` for one session. Acts and reads through role and visible text, like the quiz master. */
export class ControlScreen {
  constructor(
    readonly page: Page,
    private readonly joinCode: string,
  ) {}

  /** The desktop sidebar (the mobile bar repeats its controls but is hidden at this width). */
  private get sidebar(): Locator {
    return this.page.locator('aside');
  }

  /** Opens `/control` for the session and waits for the lobby. */
  async open(): Promise<void> {
    await this.page.goto(`/control?code=${this.joinCode}`);
    await this.expectStatus('lobby');
  }

  async expectStatus(status: string): Promise<void> {
    await expect(
      this.sidebar.getByText(`Status: ${status}`, { exact: true }),
    ).toBeVisible();
  }

  /** The Teams panel lists exactly these teams. */
  async expectTeams(teamNames: readonly string[]): Promise<void> {
    await expect(
      this.sidebar.getByRole('heading', {
        name: `Teams (${teamNames.length})`,
      }),
    ).toBeVisible();
    for (const teamName of teamNames) {
      await expect(this.sidebar.getByText(teamName)).toBeVisible();
    }
  }

  /** The Teams panel shows the team as having answered the question on air. */
  async expectTeamAnswered(teamName: string): Promise<void> {
    await expect(
      this.sidebar.getByLabel(`${teamName} has answered`),
    ).toBeVisible();
  }

  async startQuiz(): Promise<void> {
    await this.sidebar.getByRole('button', { name: 'Start Quiz' }).click();
    await this.expectStatus('rules');
  }

  /** Presses the Advance slot once and waits for the session to reach `expectedStatus`. */
  async advance(expectedStatus: string): Promise<void> {
    await this.pressAdvanceSlot();
    await this.expectStatus(expectedStatus);
  }

  async pressAdvanceSlot(): Promise<void> {
    await this.sidebar
      .getByRole('button', { name: ADVANCE_SLOT_LABEL })
      .click();
  }

  async toggleLeaderboard(): Promise<void> {
    await this.sidebar
      .getByRole('button', { name: 'Leaderboard', exact: true })
      .click();
  }

  /** Picks the question in the Grade Questions browser (1-based within its round). */
  async selectQuestion(
    roundTitle: string,
    questionNumber: number,
  ): Promise<void> {
    await this.page
      .getByRole('button', {
        name: new RegExp(`^Grade question ${questionNumber} of ${roundTitle}`),
      })
      .click();
  }

  /** The team's row in the answers panel of the selected question. */
  answerRow(teamName: string): Locator {
    return this.page.getByRole('listitem').filter({
      has: this.page.getByRole('button', {
        name: `Grade ${teamName} 0 points`,
      }),
    });
  }

  async grade(teamName: string, size: GradeSize): Promise<void> {
    await this.page
      .getByRole('button', { name: `Grade ${teamName} ${size}` })
      .click();
  }
}
