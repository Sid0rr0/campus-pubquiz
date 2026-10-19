import { expect, type Locator, type Page } from '@playwright/test';
import { recordMove } from '../coverage';

/** The Advance slot's label depends on the status (and on the leaderboard); this matches every one. */
const ADVANCE_SLOT_LABEL =
  /^(Advance|Begin Quiz|Continue|Start Round|Show Next Team|Hide Leaderboard|Hide Join Overlay)$/;

/** A team's recovery code: three upper-case words, such as QUICK-JADE-FOX. */
const TEAM_CODE_PATTERN = /^[A-Z]+(-[A-Z]+){2}$/;

/** The banner shown while the socket is down (`RECONNECTING_MESSAGE` in the frontend). */
const CONNECTION_LOST = 'Connection lost — reconnecting…';

export type GradeSize = '0 points' | 'half points' | 'full points';

/** The quiz master's laptop: `/control` for one session. Acts and reads through role and visible text, like the quiz master. */
export class ControlScreen {
  readonly kind = 'control';

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

  /** The sidebar warns that the connection to the backend is lost. */
  async expectReconnecting(): Promise<void> {
    await expect(
      this.sidebar.getByRole('alert').filter({ hasText: CONNECTION_LOST }),
    ).toBeVisible();
  }

  /** The connection warning is gone: the laptop is talking to the backend again. */
  async expectNoConnectionWarning(): Promise<void> {
    await expect(this.sidebar.getByRole('alert')).toHaveCount(0);
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

  /** The Teams panel shows the team's phone as connected (or not). */
  async expectTeamConnected(
    teamName: string,
    isConnected = true,
  ): Promise<void> {
    await expect(
      this.sidebar
        .getByRole('listitem')
        .filter({ hasText: teamName })
        .getByText(isConnected ? 'Connected' : 'Disconnected', { exact: true }),
    ).toHaveCount(1);
  }

  /** The Teams panel no longer lists the team. */
  async expectTeamGone(teamName: string): Promise<void> {
    await expect(this.sidebar.getByText(teamName)).toHaveCount(0);
  }

  /** Presses Kick on the team's row in the Teams panel and confirms the dialog. */
  async kickTeam(teamName: string): Promise<void> {
    await this.sidebar
      .getByRole('listitem')
      .filter({ hasText: teamName })
      .getByRole('button', { name: 'Kick' })
      .click();
    await this.page
      .getByRole('alertdialog', { name: `Kick ${teamName}?` })
      .getByRole('button', { name: 'Kick', exact: true })
      .click();
  }

  /** Opens the team's code dialog from the Teams table, reads the recovery code and closes it. The table appears once the quiz has started. */
  async readTeamCode(teamName: string): Promise<string> {
    await this.page
      .getByRole('button', { name: `Actions for ${teamName}` })
      .click();
    await this.page.getByRole('menuitem', { name: 'Show team code' }).click();
    const dialog = this.page.getByRole('dialog', {
      name: `Team code — ${teamName}`,
    });
    const code = await dialog.getByText(TEAM_CODE_PATTERN).innerText();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    return code;
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
    recordMove('leaderboard_toggle');
  }

  /** Presses the Advance slot while the leaderboard is up, which reveals the next team's rank. */
  async revealNextLeaderboardTeam(): Promise<void> {
    await this.pressAdvanceSlot();
    recordMove('leaderboard_reveal');
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
