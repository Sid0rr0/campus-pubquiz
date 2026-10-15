import { expect, type Page } from '@playwright/test';

/** What a kicked phone is told (`KICK_NOTICE` in the frontend). */
const KICK_NOTICE = 'You were removed from this team by the quiz master';
const TEAM_CODE_LABEL = /^Team code/;
/** The banner shown while the socket is down (`RECONNECTING_MESSAGE` in the frontend). */
const CONNECTION_LOST = 'Connection lost — reconnecting…';

/** A team's phone: `/play` in a mobile-emulated context with its own localStorage. */
export class PhoneScreen {
  constructor(
    readonly page: Page,
    readonly teamName: string,
    private readonly joinCode: string,
  ) {}

  /** Opens the join link (what the QR code holds), enters the team name and waits for the lobby. */
  async join(): Promise<void> {
    await this.page.goto(`/play?code=${this.joinCode}`);
    await this.page.getByLabel('Team name').fill(this.teamName);
    await this.page.getByRole('button', { name: 'Join the quiz' }).click();
    await expect(this.page.getByText("You're in!")).toBeVisible();
    await expect(
      this.page.getByText(`Look for ${this.teamName} on the big screen`),
    ).toBeVisible();
  }

  /** Opens the join link on a phone that has no team yet and submits the form with the team's recovery code, without waiting for the outcome (the join may be refused, or land mid-game). */
  async joinWithTeamCode(teamCode: string): Promise<void> {
    await this.page.goto(`/play?code=${this.joinCode}`);
    await this.page.getByLabel('Team name').fill(this.teamName);
    await this.page.getByLabel(TEAM_CODE_LABEL).fill(teamCode);
    await this.pressJoin();
  }

  async pressJoin(): Promise<void> {
    await this.page.getByRole('button', { name: 'Join the quiz' }).click();
  }

  /** The join was refused with a message matching `reason`, and the phone stays on the join form. */
  async expectJoinRefused(reason: RegExp): Promise<void> {
    await expect(
      this.page.getByRole('alert').filter({ hasText: reason }),
    ).toBeVisible();
    await expect(this.page.getByLabel('Team name')).toBeVisible();
  }

  /** The kicked phone is back on the bare join screen with the removal notice and nothing prefilled. */
  async expectKicked(): Promise<void> {
    await expect(this.page.getByText(KICK_NOTICE)).toBeVisible();
    await expect(this.page).toHaveURL(/\/play(\?|$)/);
    await expect(this.page.getByLabel('Team name')).toHaveValue('');
    await expect(this.page.getByLabel(TEAM_CODE_LABEL)).toHaveValue('');
  }

  /** Makes sure the join form's select shows the running quiz, picking it if the phone did not arrive with its join code. */
  async pickQuiz(quizTitle: string): Promise<void> {
    const select = this.page.getByRole('combobox', { name: 'Pick the quiz' });
    await expect(select).toBeEnabled();
    if ((await select.innerText()).includes(quizTitle)) return;
    await select.click();
    await this.page.getByRole('option', { name: quizTitle }).click();
  }

  /** Types the team name (and the recovery code, when given) into the join form and presses Join. */
  async rejoin(teamCode?: string): Promise<void> {
    await this.page.getByLabel('Team name').fill(this.teamName);
    if (teamCode) await this.page.getByLabel(TEAM_CODE_LABEL).fill(teamCode);
    await this.pressJoin();
  }

  /** The phone's browser closes: its socket drops, the page is gone. */
  async close(): Promise<void> {
    await this.page.close();
  }

  /** Reloads the page; the context and its localStorage stay, as when a phone's browser refreshes. */
  async reload(): Promise<void> {
    await this.page.reload();
  }

  /** The phone goes offline (or comes back online) while its page stays open. */
  async setOffline(isOffline: boolean): Promise<void> {
    await this.page.context().setOffline(isOffline);
  }

  /** The phone warns that the connection is lost and it is trying again. */
  async expectReconnecting(): Promise<void> {
    await expect(
      this.page.getByRole('alert').filter({ hasText: CONNECTION_LOST }),
    ).toBeVisible();
  }

  /** The phone shows a text (a house rule, a round title). */
  async expectText(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible();
  }

  /** The question's prompt is on the phone. */
  async expectQuestion(prompt: string): Promise<void> {
    await expect(
      this.page.getByRole('heading', { name: prompt }),
    ).toBeVisible();
  }

  /** Opens question `questionNumber` of round `roundNumber` in the block browser. */
  async openQuestion(
    roundNumber: number,
    questionNumber: number,
  ): Promise<void> {
    await this.page
      .getByRole('navigation', { name: `Round ${roundNumber} questions` })
      .getByRole('button', {
        name: new RegExp(`^Question ${questionNumber}\\b`),
      })
      .click();
  }

  /** Types `value` and presses Submit; resolves once the server has saved it. */
  async submitText(value: string): Promise<void> {
    await this.page.getByLabel('Your answer').fill(value);
    await this.page
      .getByRole('button', { name: 'Submit', exact: true })
      .click();
    await this.expectSubmitted(value);
  }

  /** Picks the option and presses Submit; resolves once the server has saved it. */
  async submitChoice(option: string): Promise<void> {
    await this.page.getByRole('button', { name: option, exact: true }).click();
    await this.page
      .getByRole('button', { name: 'Submit', exact: true })
      .click();
    await this.expectSubmitted(option);
  }

  /** The answer on file for the open question, as the server acknowledged it. */
  async expectSubmitted(value: string): Promise<void> {
    await expect(this.page.getByText(`Submitted: ${value}`)).toBeVisible();
  }

  /** The block has locked: the answer can be read but no longer changed. */
  async expectAnswersLocked(): Promise<void> {
    await expect(
      this.page.getByText('Answering is locked for this question'),
    ).toBeVisible();
    await expect(this.page.getByLabel('Your answer')).toHaveCount(0);
    await expect(
      this.page.getByRole('button', { name: 'Submit', exact: true }),
    ).toHaveCount(0);
  }

  /** The revealed question shows the team's own answer. */
  async expectRevealedAnswer(answer: string): Promise<void> {
    await expect(this.page.getByText(`Your answer: ${answer}`)).toBeVisible();
  }

  async expectRevealedPoints(points: number, outOf: number): Promise<void> {
    await expect(
      this.page.getByText(`${points} / ${outOf} points`),
    ).toBeVisible();
  }

  /** The team's own row on the leaderboard the big screen has revealed. */
  async expectOwnStanding(points: number): Promise<void> {
    await expect(this.page.getByTestId('own-leaderboard-row')).toContainText(
      `${this.teamName} · ${points} pts`,
    );
  }
}
