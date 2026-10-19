import { expect, type Locator, type Page } from '@playwright/test';

export type EditorQuestionType = 'Free text' | 'Multiple choice';

/** What `addQuestion` fills in; every field but the prompt is optional. */
export interface QuestionDraft {
  prompt: string;
  type: EditorQuestionType;
  points: number;
  /** The accepted answer of a `Free text` question. */
  answer?: string;
  /** The options of a `Multiple choice` question; `correctOption` is the 0-based index of the right one. */
  options?: readonly string[];
  correctOption?: number;
  mediaUrl?: string;
}

/** The quiz editor (`/quizzes/new`, `/quizzes/<id>`) and the session picker it hands over to. Acts through labels and roles, like the author. */
export class EditorScreen {
  constructor(readonly page: Page) {}

  /** Opens a blank quiz and starts it from scratch (one empty "Round 1"). */
  async openNewQuiz(): Promise<void> {
    await this.page.goto('/quizzes/new');
    await this.page.getByRole('button', { name: 'Start from scratch' }).click();
    await expect(this.titleInput).toBeVisible();
  }

  private get titleInput(): Locator {
    return this.page.getByPlaceholder('Untitled quiz');
  }

  private round(roundIndex: number): Locator {
    return this.page.locator('[id^="round-"]').nth(roundIndex);
  }

  private question(roundIndex: number, questionIndex: number): Locator {
    return this.round(roundIndex)
      .locator('[id^="question-"]')
      .nth(questionIndex);
  }

  async setQuizTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  async addRound(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add round' }).click();
  }

  async setRound(
    roundIndex: number,
    round: { title: string; hasBreakAfter?: boolean },
  ): Promise<void> {
    const card = this.round(roundIndex);
    await card.getByPlaceholder('Round title').fill(round.title);
    if (round.hasBreakAfter) await card.getByLabel('Break after').check();
  }

  /** Adds a question at the end of the round and fills it in. */
  async addQuestion(roundIndex: number, draft: QuestionDraft): Promise<void> {
    const card = this.round(roundIndex);
    const questionIndex = await card.locator('[id^="question-"]').count();
    await card.getByRole('button', { name: 'Add question' }).click();
    const question = this.question(roundIndex, questionIndex);
    await expect(question).toBeVisible();

    await question.getByPlaceholder('Question prompt').fill(draft.prompt);
    await question
      .getByRole('button', { name: draft.type, exact: true })
      .click();
    await question
      .getByLabel('Points', { exact: true })
      .fill(String(draft.points));
    if (draft.answer !== undefined) {
      await question.getByPlaceholder('Accepted answer').fill(draft.answer);
    }
    if (draft.options) await this.fillOptions(question, draft);
    if (draft.mediaUrl) {
      await question
        .getByLabel('Media URL', { exact: true })
        .fill(draft.mediaUrl);
    }
  }

  private async fillOptions(
    question: Locator,
    draft: QuestionDraft,
  ): Promise<void> {
    const options = draft.options ?? [];
    const inputs = question.getByPlaceholder('Option text');
    // A new multiple-choice question starts with two empty options.
    for (let missing = options.length - 2; missing > 0; missing--) {
      await question.getByRole('button', { name: 'Add option' }).click();
    }
    await expect(inputs).toHaveCount(options.length);
    for (const [optionIndex, text] of options.entries()) {
      await inputs.nth(optionIndex).fill(text);
    }
    await question
      .getByLabel(`Mark option ${(draft.correctOption ?? 0) + 1} as correct`)
      .check();
  }

  /** Presses Save and waits for the editor to move to the saved quiz's own URL. */
  async save(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save quiz' }).click();
    await expect(this.page).toHaveURL(/\/quizzes\/\d+$/);
  }

  async expectQuizTitle(title: string): Promise<void> {
    await expect(this.titleInput).toHaveValue(title);
  }

  async expectQuestionPrompt(
    roundIndex: number,
    questionIndex: number,
    prompt: string,
  ): Promise<void> {
    await expect(
      this.question(roundIndex, questionIndex).getByPlaceholder(
        'Question prompt',
      ),
    ).toHaveValue(prompt);
  }

  /** On the session picker: starts a session from the quiz with the lock grace given, and resolves with the join code of the console it lands on. */
  async startSession(
    quizTitle: string,
    lockGraceSeconds: number,
  ): Promise<string> {
    await this.page.goto('/sessions');
    await this.page
      .getByRole('row')
      .filter({ hasText: quizTitle })
      .getByRole('button', { name: 'Start' })
      .click();
    const dialog = this.page.getByRole('dialog', {
      name: `Start "${quizTitle}"?`,
    });
    await dialog.getByRole('tab', { name: 'Settings' }).click();
    await dialog
      .getByLabel('Lock round after (seconds)')
      .fill(String(lockGraceSeconds));
    await dialog.getByRole('button', { name: 'Confirm' }).click();

    await expect(this.page).toHaveURL(/\/control\?code=[A-Za-z0-9]+/);
    return new URL(this.page.url()).searchParams.get('code') ?? '';
  }
}
