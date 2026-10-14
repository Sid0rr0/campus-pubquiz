import { expect, type Page } from '@playwright/test';

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

  /** Reloads the page; the context and its localStorage stay, as when a phone's browser refreshes. */
  async reload(): Promise<void> {
    await this.page.reload();
  }

  /** The phone goes offline (or comes back online) while its page stays open. */
  async setOffline(isOffline: boolean): Promise<void> {
    await this.page.context().setOffline(isOffline);
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
