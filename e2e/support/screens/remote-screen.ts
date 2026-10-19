import { expect, type Locator, type Page } from '@playwright/test';
import { recordMove } from '../coverage';

/** The Advance slot's label depends on the status; this matches every one. */
const ADVANCE_SLOT_LABEL =
  /^(Advance|Begin Quiz|Continue|Start Round|Show Next Team|Hide Leaderboard|Hide Join Overlay)$/;

/**
 * The presenter's phone: `/remote` for one session. Not one of the three
 * tracked screens, so it has no coverage cells: `matchSnapshot` compares the
 * page with `remote-<name>.aria.yml` and records nothing. The media presses
 * record their moves, as on `/control`.
 */
export class RemoteScreen {
  constructor(
    readonly page: Page,
    private readonly joinCode: string,
  ) {}

  private region(name: string): Locator {
    return this.page.getByRole('region', { name, exact: true });
  }

  /** Opens `/remote` for the session and waits for the "On display" card. */
  async open(): Promise<void> {
    await this.page.goto(`/remote?code=${this.joinCode}`);
    await expect(this.region('On display')).toBeVisible();
  }

  /** Compares the page's ARIA structure with the snapshot file `remote-<name>.aria.yml`. */
  async matchSnapshot(name: string): Promise<void> {
    await expect(this.page.locator('body')).toMatchAriaSnapshot({
      name: `remote-${name}.aria.yml`,
    });
  }

  /** The "On display" card names the screen on air (its heading, such as "R1 Q2"). */
  async expectOnDisplay(heading: string | RegExp): Promise<void> {
    await expect(this.region('On display')).toContainText(heading);
  }

  /** The "Up next" line describes the screen the next Advance leads to. */
  async expectUpNext(text: string | RegExp): Promise<void> {
    await expect(this.region('Up next')).toContainText(text);
  }

  async expectNotes(text: string): Promise<void> {
    await expect(this.region('Notes')).toContainText(text);
  }

  async expectAnsweredCount(
    answered: number,
    teamCount: number,
  ): Promise<void> {
    await expect(
      this.page.getByText(`${answered}/${teamCount} teams answered`),
    ).toBeVisible();
  }

  /** Presses the Advance slot once. */
  async advance(): Promise<void> {
    await this.page.getByRole('button', { name: ADVANCE_SLOT_LABEL }).click();
  }

  async pause(): Promise<void> {
    await this.page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(
      this.page.getByRole('button', { name: 'Resume', exact: true }),
    ).toBeVisible();
    recordMove('media_pause');
  }

  async resume(): Promise<void> {
    await this.page
      .getByRole('button', { name: 'Resume', exact: true })
      .click();
    await expect(
      this.page.getByRole('button', { name: 'Pause', exact: true }),
    ).toBeVisible();
  }

  async replay(): Promise<void> {
    await this.page.getByRole('button', { name: 'Play video again' }).click();
    recordMove('media_replay');
  }

  async toggleFullscreen(isEntering: boolean): Promise<void> {
    await this.page
      .getByRole('button', {
        name: isEntering ? 'Fullscreen media' : 'Exit fullscreen media',
      })
      .click();
    await expect(
      this.page.getByRole('button', {
        name: isEntering ? 'Exit fullscreen media' : 'Fullscreen media',
      }),
    ).toHaveAttribute('aria-pressed', String(isEntering));
    recordMove('media_fullscreen');
  }
}
