import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures';
import { ADMIN_STORAGE_STATE } from '../support/env';
import { ControlScreen } from '../support/screens/control-screen';
import { DisplayScreen } from '../support/screens/display-screen';
import { EditorScreen } from '../support/screens/editor-screen';
import { PhoneScreen } from '../support/screens/phone-screen';

const LOCK_GRACE_SECONDS = 1;

// What the author builds in the editor: two rounds with a break between them.
const ROUND_ONE = { title: 'Capitals', hasBreakAfter: true };
const ROUND_TWO = { title: 'Space' };
const CAPITAL = {
  prompt: 'What is the capital of Italy?',
  type: 'Free text',
  points: 2,
  answer: 'Rome',
  mediaUrl: 'https://example.invalid/e2e-colosseum.png',
} as const;
const PLANET = {
  prompt: 'Which planet is known as the Red Planet?',
  type: 'Multiple choice',
  points: 3,
  options: ['Venus', 'Mars', 'Jupiter'],
  correctOption: 1,
} as const;

test('a quiz built in the editor is saved, started as a session and played as authored', async ({
  newContext,
  newPhoneContext,
}) => {
  // 1. The author builds the quiz in the editor, with nothing imported.
  const quizTitle = `Editor quiz ${randomUUID().slice(0, 6)}`;
  const adminContext = await newContext({
    storageState: ADMIN_STORAGE_STATE,
    viewport: { width: 1280, height: 800 },
  });
  const adminPage = await adminContext.newPage();
  const editor = new EditorScreen(adminPage);

  await editor.openNewQuiz();
  await editor.setQuizTitle(quizTitle);
  // The last round always breaks, so "Break after" can only be ticked once a second round exists.
  await editor.addRound();
  await editor.setRound(0, ROUND_ONE);
  await editor.addQuestion(0, CAPITAL);
  await editor.setRound(1, ROUND_TWO);
  await editor.addQuestion(1, PLANET);
  await expect(adminPage.getByText('2 rounds · 2 questions')).toBeVisible();
  await editor.save();

  // The saved quiz comes back from the server as authored.
  await adminPage.reload();
  await editor.expectQuizTitle(quizTitle);
  await editor.expectQuestionPrompt(0, 0, CAPITAL.prompt);
  await editor.expectQuestionPrompt(1, 0, PLANET.prompt);

  // 2. The author starts a session from it (the lock grace is 1 s, like every E2E timer).
  const joinCode = await editor.startSession(quizTitle, LOCK_GRACE_SECONDS);
  const control = new ControlScreen(adminPage, joinCode);
  await control.expectStatus('lobby');

  const displayContext = await newContext({
    viewport: { width: 1280, height: 720 },
  });
  const display = new DisplayScreen(await displayContext.newPage(), joinCode);
  await display.open();

  const phone = new PhoneScreen(
    await (await newPhoneContext()).newPage(),
    `Editors ${randomUUID().slice(0, 6)}`,
    joinCode,
  );
  await phone.join();
  await control.expectTeams([phone.teamName]);

  // 3. Round one plays as authored: the title card, then the free-text question with its picture.
  await control.startQuiz();
  await control.advance('round_intro');
  await display.expectText(ROUND_ONE.title);
  await phone.expectText(ROUND_ONE.title);
  await control.advance('question_open');
  await display.expectQuestion(CAPITAL.prompt);
  await expect(
    display.page.getByRole('img', { name: 'Question image' }),
  ).toHaveAttribute('src', CAPITAL.mediaUrl);
  await phone.expectQuestion(CAPITAL.prompt);
  await phone.submitText(CAPITAL.answer);

  // 4. The block locks, the break begins, and the answer is revealed with its points.
  // The 1 s countdown is over almost at once, so `locking` is not waited for.
  await control.pressAdvanceSlot();
  await control.expectStatus('break_intro');
  await display.expectBreak(1);
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await display.expectRevealedAnswer(CAPITAL.answer);
  await phone.expectRevealedAnswer(CAPITAL.answer);
  await phone.expectRevealedPoints(CAPITAL.points, CAPITAL.points);

  // 5. Round two plays as authored: the multiple-choice question offers the authored options.
  await control.advance('round_intro');
  await display.expectText(ROUND_TWO.title);
  await control.advance('question_open');
  await display.expectQuestion(PLANET.prompt);
  await phone.expectQuestion(PLANET.prompt);
  for (const option of PLANET.options) {
    await expect(
      phone.page.getByRole('button', { name: option, exact: true }),
    ).toBeVisible();
  }
  await phone.submitChoice(PLANET.options[PLANET.correctOption]);
  await control.expectTeamAnswered(phone.teamName);
});
