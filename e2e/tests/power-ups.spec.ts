import { test as base, expect } from '../fixtures';
import { awardBonus, expectTeamsTablePoints } from '../support/bonus';
import { recordMove } from '../support/coverage';
import { E2E_LOCK_GRACE_SECONDS } from '../support/env';
import { expectStampedStandingsRow } from '../support/joker-night';
import {
  awardCoins,
  buyExtraJoker,
  buyPowerUp,
  expectCoins,
  expectTeamsTableCoins,
  openShop,
  POWER_UP_NIGHT,
  seedPowerUpSession,
} from '../support/power-ups';
import {
  POWER_UP_TABLE_WITH_TWO_PINS,
  QUESTION_POWER_UPS,
  QUESTION_POWER_UPS_COINS,
  buyQuestionPowerUp,
  disabledOptions,
  peekAtShop,
  pinnedItem,
} from '../support/question-power-ups';
import { snap } from '../support/snapshots';

const { helps } = POWER_UP_NIGHT;
const { multipleChoice } = helps;
const MC_OPTIONS = ['Venus', 'Mars', 'Jupiter', 'Saturn'];

// Ask the room costs 3 coins by default: one purchase empties the balance.
const ask = base.extend({
  session: async ({ adminApi, sessionSettings }, use) => {
    await use(
      await seedPowerUpSession(
        adminApi,
        `Ask the room ${Date.now().toString(36)}`,
        { ...sessionSettings, startingCoins: 3 },
      ),
    );
  },
});

const coinAwardTest = base.extend({
  session: async ({ adminApi }, use) => {
    await use(
      await seedPowerUpSession(
        adminApi,
        `Coin awards ${Date.now().toString(36)}`,
        { startingCoins: 0 },
      ),
    );
  },
});

const questionPowerUpsTest = base.extend({
  session: async ({ adminApi }, use) => {
    const quizTitle = `Question power-ups ${Date.now().toString(36)}`;
    await use(
      await seedPowerUpSession(adminApi, quizTitle, {
        lockGraceSeconds: E2E_LOCK_GRACE_SECONDS,
        startingCoins: QUESTION_POWER_UPS_COINS,
        powerUps: POWER_UP_TABLE_WITH_TWO_PINS,
      }),
    );
  },
});

ask(
  'ask the room: waits for three other answers, then shows the split without team names',
  async ({ control, joinPhone }) => {
    const answerers = [
      await joinPhone('Team A'),
      await joinPhone('Team B'),
      await joinPhone('Team C'),
    ];
    const buyer = await joinPhone('Team D');
    await control.startQuiz();
    await control.advance('round_intro');
    await control.advance('question_open');
    await buyer.expectQuestion(multipleChoice.prompt);

    const waiting = async () => {
      const drawer = await openShop(buyer);
      const button = drawer.getByRole('button', {
        name: 'Activate Ask the room',
      });
      await expect(button).toBeDisabled();
      await expect(button).toHaveText('Waiting for more answers');
      await buyer.page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
    };

    // Two other answers are not enough; the split is Mars twice, Venus once.
    await answerers[0].expectQuestion(multipleChoice.prompt);
    await answerers[0].submitChoice(multipleChoice.key);
    await answerers[1].submitChoice(multipleChoice.key);
    await waiting();

    await answerers[2].submitChoice('Venus');
    const drawer = await openShop(buyer);
    await expect(
      drawer.getByRole('button', { name: 'Activate Ask the room' }),
    ).toBeEnabled();
    await buyer.page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    await buyPowerUp(buyer, 'Ask the room');
    recordMove('power_up_ask_the_room');
    await expectCoins(buyer, 0);

    const split = buyer.page.getByTestId('room-split');
    await expect(split).toContainText(/Venus\s*33%/);
    await expect(split).toContainText(/Mars\s*67%/);
    await expect(split).toContainText(/Jupiter\s*0%/);
    await expect(split).toContainText(/Saturn\s*0%/);
    for (const phone of [...answerers, buyer]) {
      await expect(split).not.toContainText(phone.teamName);
    }
  },
);

coinAwardTest(
  'coin awards: a shot brings 2 coins, a manual give and take move the balance and no points',
  async ({ control, joinPhone }) => {
    const phone = await joinPhone('Team A');
    await control.expectTeams([phone.teamName]);
    await control.startQuiz();
    await control.advance('round_intro');
    await control.advance('question_open');
    await expectCoins(phone, 0);
    await expectTeamsTableCoins(control, phone.teamName, 0);

    // 1. A shot award is 1 point and +2 coins, with a toast on the phone.
    await awardBonus(control, phone.teamName, 'shot', 1);
    await expect(phone.page.getByText('+2 coins')).toBeVisible();
    await expectCoins(phone, 2);
    await expectTeamsTableCoins(control, phone.teamName, 2);
    await expectTeamsTablePoints(control, phone.teamName, 1, 1);

    // 2. A manual give changes the balance only.
    await awardCoins(control, phone.teamName, 5);
    await expect(phone.page.getByText('+5 coins')).toBeVisible();
    await expectCoins(phone, 7);
    await expectTeamsTableCoins(control, phone.teamName, 7);
    await expectTeamsTablePoints(control, phone.teamName, 1, 1);

    // 3. A manual take does too.
    await awardCoins(control, phone.teamName, -3);
    await expect(phone.page.getByText('-3 coins')).toBeVisible();
    await expectCoins(phone, 4);
    await expectTeamsTableCoins(control, phone.teamName, 4);
    await expectTeamsTablePoints(control, phone.teamName, 1, 1);
  },
);

questionPowerUpsTest(
  'question power-ups: a team buys each help in round 1 and the effects show on the phone, /control and /display',
  async ({ control, display, joinPhone }) => {
    const phone = await joinPhone('Team A');
    await control.startQuiz();
    await control.advance('round_intro');

    // 1. 50/50 removes two options and never the right one.
    await control.advance('question_open');
    await phone.expectQuestion(helps.multipleChoice.prompt);
    await expectCoins(phone, QUESTION_POWER_UPS_COINS);
    await peekAtShop(phone, () => snap(phone, 'question_open', 'shop'));
    await buyQuestionPowerUp(phone, QUESTION_POWER_UPS.fiftyFifty);
    await expectCoins(phone, QUESTION_POWER_UPS_COINS - 2);
    await expect.poll(() => disabledOptions(phone, MC_OPTIONS)).toHaveLength(2);
    expect(await disabledOptions(phone, MC_OPTIONS)).not.toContain(
      helps.multipleChoice.key,
    );
    await phone.submitChoice(helps.multipleChoice.key);

    // 2. The two hints for the free text's key.
    await control.advance('question_open');
    await phone.expectQuestion(helps.freeText.prompt);
    await buyQuestionPowerUp(phone, QUESTION_POWER_UPS.firstLetter);
    await expect(phone.page.getByText('First letter: P')).toBeVisible();
    await buyQuestionPowerUp(phone, QUESTION_POWER_UPS.letterCount);
    await expect(phone.page.getByText('Letter count: _____')).toBeVisible();
    await expectCoins(phone, QUESTION_POWER_UPS_COINS - 2 - 2 - 1);
    await phone.submitText(helps.freeText.key);

    // 3. Pin one on the sort and on the match: one 📌 and one disabled handle each.
    await control.advance('question_open');
    await phone.expectQuestion(helps.sort.prompt);
    await buyQuestionPowerUp(phone, QUESTION_POWER_UPS.pinOne);
    await pinnedItem(phone);
    await phone.page
      .getByRole('button', { name: 'Submit', exact: true })
      .click();
    await expect(phone.page.getByText(/Submitted:/)).toBeVisible();

    await control.advance('question_open');
    await phone.expectQuestion(helps.match.prompt);
    await buyQuestionPowerUp(phone, QUESTION_POWER_UPS.pinOne);
    const pinnedMatchItem = await pinnedItem(phone);
    await phone.page
      .getByRole('button', { name: 'Submit', exact: true })
      .click();
    await expect(phone.page.getByText(/Submitted:/)).toBeVisible();

    // 4. Wider margin after submitting 215 (key 200, 5%): no second submit.
    await control.advance('question_open');
    await phone.expectQuestion(helps.numeric.prompt);
    await phone.submitText('215');
    await buyQuestionPowerUp(phone, QUESTION_POWER_UPS.widerMargin);
    await expectCoins(phone, 0);

    // 5. A reload keeps the removed options and the pinned item.
    await phone.reload();
    await phone.openQuestion(1, 1);
    await phone.expectQuestion(helps.multipleChoice.prompt);
    await expect.poll(() => disabledOptions(phone, MC_OPTIONS)).toHaveLength(2);
    expect(await disabledOptions(phone, MC_OPTIONS)).not.toContain(
      helps.multipleChoice.key,
    );
    await phone.openQuestion(1, 4);
    await phone.expectQuestion(helps.match.prompt);
    expect(await pinnedItem(phone)).toBe(pinnedMatchItem);

    // 6. /control labels the answers with the power-ups used.
    await control.selectQuestion(helps.title, 5);
    await expect(control.answerRow(phone.teamName)).toContainText(
      'Wider margin',
    );
    await snap(control, 'question_open', 'power-ups');

    await control.advance('locking');
    await control.expectStatus('break_intro');
    const labelsByQuestion: [number, string[]][] = [
      [1, ['50/50']],
      [2, ['First letter', 'Letter count']],
      [3, ['Pin one']],
      [4, ['Pin one']],
      [5, ['Wider margin']],
    ];
    for (const [questionNumber, labels] of labelsByQuestion) {
      await control.selectQuestion(helps.title, questionNumber);
      for (const label of labels) {
        await expect(control.answerRow(phone.teamName)).toContainText(label);
      }
    }

    // 7. /display counts the power-ups at each reveal; the late wider margin made 215 right.
    await control.advance('reveal_intro');
    await control.advance('reveal');
    await display.expectText('Power-ups used: 50/50 ×1');
    await control.advance('reveal');
    await display.expectText(
      'Power-ups used: First letter ×1 · Letter count ×1',
    );
    await control.advance('reveal');
    await display.expectText('Power-ups used: Pin one ×1');
    await control.advance('reveal');
    await display.expectText('Power-ups used: Pin one ×1');
    await control.advance('reveal');
    await display.expectText('Power-ups used: Wider margin ×1');
    await snap(display, 'reveal', 'power-ups');
    await phone.expectRevealedAnswer('215');
    await phone.expectRevealedPoints(2, 2);
  },
);

// The extra joker costs 6 with the round overview on; the team starts with exactly that.
const EXTRA_JOKER_COST = 6;
// It answers the first question right and doubles the whole round: 2 points, twice.
const DOUBLED_TOTAL = 4;

const named = base.extend({
  session: async ({ adminApi }, use) => {
    const quizTitle = `Power-ups ${Date.now().toString(36)}`;
    await use(
      await seedPowerUpSession(adminApi, quizTitle, {
        lockGraceSeconds: E2E_LOCK_GRACE_SECONDS,
        showRoundOverview: true,
        startingCoins: EXTRA_JOKER_COST,
      }),
    );
  },
});

named(
  'extra joker, named: the offer names the round and costs 6, and the round scores double',
  async ({ control, display, joinPhone }) => {
    const phone = await joinPhone('Team A');
    await control.startQuiz();
    await control.advance('round_overview');

    // 1. The offer names the next round and its price; buying takes all the coins.
    await expectCoins(phone, EXTRA_JOKER_COST);
    const drawer = await openShop(phone);
    const offer = drawer.getByRole('button', { name: 'Activate Extra joker' });
    await expect(offer).toContainText(`the next round: ${helps.title}`);
    await expect(offer).toContainText('6 coins');
    await buyExtraJoker(drawer);
    await expectCoins(phone, 0);

    // 2. Play the round, answering only the first question.
    await control.advance('round_intro');
    await control.advance('question_open');
    await phone.expectQuestion(helps.multipleChoice.prompt);
    await phone.submitChoice(helps.multipleChoice.key);
    for (let i = 1; i < 5; i += 1) await control.advance('question_open');
    await control.advance('locking');
    await control.expectStatus('break_intro');
    await control.advance('reveal_intro');
    await control.advance('reveal');

    // 3. The leaderboard total has the round's points doubled.
    await control.toggleLeaderboard();
    await control.revealNextLeaderboardTeam();
    await expectStampedStandingsRow(
      display,
      phone.teamName,
      DOUBLED_TOTAL,
      true,
    );
    await phone.expectOwnStanding(DOUBLED_TOTAL);
  },
);
