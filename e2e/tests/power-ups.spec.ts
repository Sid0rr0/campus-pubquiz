import { test as base, expect } from '../fixtures';
import { recordMove } from '../support/coverage';
import {
  buyPowerUp,
  expectCoins,
  openShop,
  POWER_UP_NIGHT,
  seedPowerUpSession,
} from '../support/power-ups';

const { multipleChoice } = POWER_UP_NIGHT.helps;

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
