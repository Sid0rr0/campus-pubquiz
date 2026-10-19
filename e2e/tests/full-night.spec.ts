import type { Status } from '../support/coverage';
import { expect, FULL_NIGHT, test } from '../support/full-night';
import {
  awardBonus,
  expectPodiumStep,
  expectStandingsRow,
  previousAcrossBlock,
  previousInBreakReview,
  toggleJoinOverlay,
} from '../support/night-moves';
import type { ControlScreen } from '../support/screens/control-screen';
import type { DisplayScreen } from '../support/screens/display-screen';
import type { PhoneScreen } from '../support/screens/phone-screen';
import { snap } from '../support/snapshots';

const { warmUp, music, film, quickFire, bonusPoints } = FULL_NIGHT;

// Team A gets every typed answer in the first block right and Team B only half of the first.
const TEAM_A_AFTER_BLOCK_ONE =
  warmUp.capital.points + warmUp.planet.points + music.band.points;
const TEAM_B_AFTER_BLOCK_ONE = warmUp.capital.halfPoints + bonusPoints;
const TEAM_A_AFTER_BLOCK_TWO =
  TEAM_A_AFTER_BLOCK_ONE + film.clip.points + film.wall.points;
const TEAM_B_AFTER_BLOCK_TWO = TEAM_B_AFTER_BLOCK_ONE;
const TEAM_A_FINAL = TEAM_A_AFTER_BLOCK_TWO + quickFire.badminton.points;
const TEAM_B_FINAL = TEAM_B_AFTER_BLOCK_TWO + quickFire.football.points;

/** The E2E build shortens the break screen's wait for its first fun fact (see `FUN_FACT_START_DELAY_MS` in `support/env.ts`); clocks are never faked. A reused build from before that change still waits a minute and fails here: rebuild. */
const FUN_FACT_WAIT_MS = 15_000;
const NIGHT_TIMEOUT_MS = 360_000;

interface Night {
  control: ControlScreen;
  display: DisplayScreen;
  phoneA: PhoneScreen;
  phoneB: PhoneScreen;
  joinCode: string;
}

/** Both phones show the question, then Team A and Team B type their answers. */
async function answerText(
  { phoneA, phoneB }: Night,
  prompt: string,
  answers: { a?: string; b?: string },
): Promise<void> {
  await phoneA.expectQuestion(prompt);
  await phoneB.expectQuestion(prompt);
  if (answers.a) await phoneA.submitText(answers.a);
  if (answers.b) await phoneB.submitText(answers.b);
}

/** A kahoot phone submits the moment a choice is tapped. */
async function tapKahootChoice(
  phone: PhoneScreen,
  option: string,
): Promise<void> {
  await phone.page.getByRole('button', { name: option, exact: true }).click();
  await phone.expectSubmitted(option);
}

async function snapAllScreens(
  { display, phoneA, control }: Night,
  status: Status,
): Promise<void> {
  await snap(display, status);
  await snap(phoneA, status);
  await snap(control, status);
}

async function openAndPlayBlockOne(night: Night): Promise<void> {
  const { control, display, phoneA, phoneB } = night;
  await control.advance('round_intro');
  await display.expectText(warmUp.note);
  await display.expectText(warmUp.category);
  await display.expectText(warmUp.author);
  await snapAllScreens(night, 'round_intro');

  await control.advance('question_open');
  await display.expectQuestion(warmUp.capital.prompt);
  await answerText(night, warmUp.capital.prompt, {
    a: warmUp.capital.key,
    b: 'Marseille',
  });
  await display.expectAnsweredCount(2, 2);
  await snapAllScreens(night, 'question_open');

  await control.advance('question_open');
  await display.expectQuestion(warmUp.planet.prompt);
  await expect(
    display.page.locator(`img[src="${warmUp.planet.imageUrl}"]`),
  ).toBeVisible();
  await snap(display, 'question_open', 'image');
  await phoneA.expectQuestion(warmUp.planet.prompt);
  await phoneA.submitChoice(warmUp.planet.right);
  await phoneB.expectQuestion(warmUp.planet.prompt);
  await phoneB.submitChoice(warmUp.planet.wrong);

  // The second round has a note too, but the quiz master keeps it to themselves.
  await control.advance('round_intro');
  await display.expectText(music.title);
  await expect(display.page.getByText(music.note)).toHaveCount(0);
  await snap(display, 'round_intro', 'no-note');

  await control.advance('question_open');
  await display.expectQuestion(music.band.prompt);
  await display.expectAudioPlayer(music.band.audioUrl);
  await display.expectAudioLoaded();
  await snap(display, 'question_open', 'audio');
  await answerText(night, music.band.prompt, {
    a: music.band.key,
    b: music.band.wrong,
  });

  await control.advance('question_open');
  await display.expectQuestion(music.sort.prompt);
}

async function lockBlockOne(night: Night): Promise<void> {
  const { control, display } = night;
  await control.advance('locking');
  await display.expectLockCountdown();
  await snapAllScreens(night, 'locking');
  await control.expectStatus('break_intro');
}

/** The first break: bonus, grading and the fun fact (which appears a second after the break goes on air). */
async function playFirstBreak(night: Night): Promise<void> {
  const { control, display, phoneB } = night;
  await display.expectBreak(1);
  await snapAllScreens(night, 'break_intro');
  await phoneB.openQuestion(1, 1);
  await phoneB.expectAnswersLocked();
  await phoneB.expectSubmitted('Marseille');

  await awardBonus(control, phoneB.teamName, 'Shot');
  await control.selectQuestion(warmUp.title, 1);
  await expect(control.answerRow(phoneB.teamName)).toContainText('Marseille');
  await control.grade(phoneB.teamName, 'half points');
  await control.selectQuestion(music.title, 1);
  await control.grade(phoneB.teamName, '0 points');

  const funFact = display.page.getByTestId('fun-fact');
  await expect(funFact).toBeVisible({ timeout: FUN_FACT_WAIT_MS });
  await expect(funFact).toContainText('1 shot');
  await expect(funFact).toContainText('bonus awards so far');
  await snap(display, 'break_intro', 'fun-fact');
}

/** Break review backward through both rounds with Previous, then forward again to the reveal. */
async function walkFirstBreakReview(night: Night): Promise<void> {
  const { control, display } = night;
  await previousInBreakReview(control, 'break');
  await display.expectQuestion(music.sort.prompt);
  await snapAllScreens(night, 'break');
  await previousInBreakReview(control, 'break');
  await display.expectAudioPlayer(music.band.audioUrl);
  await previousInBreakReview(control, 'break_round_intro');
  await display.expectText(music.title);
  await expect(display.page.getByText(music.note)).toHaveCount(0);
  await snapAllScreens(night, 'break_round_intro');
  await previousInBreakReview(control, 'break');
  await display.expectQuestion(warmUp.planet.prompt);
  await previousInBreakReview(control, 'break');
  await display.expectQuestion(warmUp.capital.prompt);
  await previousInBreakReview(control, 'break_round_intro');
  await display.expectText(warmUp.note);
  await snap(display, 'break_round_intro', 'note');

  await control.advance('break');
  await display.expectQuestion(warmUp.capital.prompt);
  await control.advance('break');
  await display.expectQuestion(warmUp.planet.prompt);
  await control.advance('break_round_intro');
  await control.advance('break');
  await display.expectAudioPlayer(music.band.audioUrl);
  await control.advance('break');
  await display.expectQuestion(music.sort.prompt);
}

async function revealBlockOne(night: Night): Promise<void> {
  const { control, display, phoneA, phoneB } = night;
  await control.advance('reveal_intro');
  await display.expectText(`REVEALING ANSWERS · ROUND ${warmUp.number}`);
  await snapAllScreens(night, 'reveal_intro');

  await control.advance('reveal');
  await display.expectRevealedAnswer(warmUp.capital.key);
  await phoneA.expectRevealedAnswer(warmUp.capital.key);
  await phoneA.expectRevealedPoints(
    warmUp.capital.points,
    warmUp.capital.points,
  );
  await phoneB.expectRevealedAnswer('Marseille');
  await phoneB.expectRevealedPoints(
    warmUp.capital.halfPoints,
    warmUp.capital.points,
  );
  await snapAllScreens(night, 'reveal');

  await control.advance('reveal');
  await display.expectRevealedAnswer(warmUp.planet.right);
  await phoneA.expectRevealedPoints(warmUp.planet.points, warmUp.planet.points);
  await phoneB.expectRevealedPoints(0, warmUp.planet.points);

  await control.advance('reveal_intro');
  await display.expectText(`REVEALING ANSWERS · ROUND ${music.number}`);
  await control.advance('reveal');
  await display.expectRevealedAnswer(music.band.key);
  await phoneA.expectRevealedPoints(music.band.points, music.band.points);
  await phoneB.expectRevealedPoints(0, music.band.points);
  await control.advance('reveal');
  await display.expectQuestion(music.sort.prompt);
}

/** The leaderboard that covers the next round's title card, revealed slot by slot. */
async function revealStandings(
  night: Night,
  expected: { a: number; b: number },
): Promise<void> {
  const { control, display, phoneA, phoneB } = night;
  await control.revealNextLeaderboardTeam();
  await expectStandingsRow(display, phoneB.teamName, expected.b);
  await phoneB.expectOwnStanding(expected.b);
  await control.revealNextLeaderboardTeam();
  await expectStandingsRow(display, phoneA.teamName, expected.a);
  await phoneA.expectOwnStanding(expected.a);
}

async function playBlockTwo(night: Night): Promise<void> {
  const { control, display, phoneA, phoneB, joinCode } = night;
  await control.advance('round_intro');
  await revealStandings(night, {
    a: TEAM_A_AFTER_BLOCK_ONE,
    b: TEAM_B_AFTER_BLOCK_ONE,
  });
  await snap(display, 'round_intro', 'leaderboard');
  await snap(phoneA, 'round_intro', 'leaderboard');
  await control.toggleLeaderboard();
  await display.expectText(film.title);
  await display.expectText(film.category);
  await display.expectText(film.author);

  // A late team can scan in from the join overlay, which hides again on the second press.
  await toggleJoinOverlay(control, true);
  await display.expectText(joinCode);
  await expect(display.page.getByText(film.title)).toHaveCount(0);
  await snap(display, 'round_intro', 'join-overlay');
  await toggleJoinOverlay(control, false);
  await display.expectText(film.title);

  await control.advance('question_open');
  await display.expectQuestion(film.piano.prompt);
  await control.advance('question_open');
  await display.expectQuestion(film.clip.prompt);
  await answerText(night, film.clip.prompt, {
    a: film.clip.key,
    b: film.clip.wrong,
  });
  await control.advance('question_open');
  await display.expectQuestion(film.match.prompt);
  await control.advance('question_open');
  await display.expectQuestion(film.wall.prompt);
  await answerText(night, film.wall.prompt, {
    a: film.wall.right,
    b: film.wall.wrong,
  });
  await phoneB.expectSubmitted(film.wall.wrong);
  await control.advance('locking');
  await control.expectStatus('break_intro');
}

/** Break review from the second break back across the block boundary into the first block's last reveal, then forward again. */
async function crossBackIntoBlockOne(night: Night): Promise<void> {
  const { control, display } = night;
  await display.expectBreak(2);
  await control.selectQuestion(film.title, 2);
  await control.grade(night.phoneB.teamName, '0 points');

  await previousInBreakReview(control, 'break');
  await display.expectQuestion(film.wall.prompt);
  await previousInBreakReview(control, 'break');
  await display.expectQuestion(film.match.prompt);
  await previousInBreakReview(control, 'break');
  await display.expectQuestion(film.clip.prompt);
  await previousInBreakReview(control, 'break');
  await display.expectQuestion(film.piano.prompt);
  await previousInBreakReview(control, 'break_round_intro');
  await display.expectText(film.title);
  await previousAcrossBlock(control, 'reveal');
  await display.expectQuestion(music.sort.prompt);

  // Forward again: the earlier block's last reveal leads back into the second block's round card.
  await control.advance('round_intro');
  await control.toggleLeaderboard();
  await control.advance('question_open');
  await display.expectQuestion(film.piano.prompt);
  await control.advance('question_open');
  await control.advance('question_open');
  await control.advance('question_open');
  await display.expectQuestion(film.wall.prompt);
  await control.advance('locking');
  await control.expectStatus('break_intro');
}

async function revealBlockTwo(night: Night): Promise<void> {
  const { control, display, phoneA, phoneB } = night;
  await control.advance('reveal_intro');
  await display.expectText(`REVEALING ANSWERS · ROUND ${film.number}`);
  await control.advance('reveal');
  await display.expectQuestion(film.piano.prompt);
  await control.advance('reveal');
  await display.expectRevealedAnswer(film.clip.key);
  await phoneA.expectRevealedPoints(film.clip.points, film.clip.points);
  await phoneB.expectRevealedAnswer(film.clip.wrong);
  await phoneB.expectRevealedPoints(0, film.clip.points);
  await control.advance('reveal');
  await display.expectQuestion(film.match.prompt);
  await control.advance('reveal');
  await display.expectQuestion(film.wall.prompt);
  await phoneA.expectRevealedAnswer(film.wall.right);
  await phoneA.expectRevealedPoints(film.wall.points, film.wall.points);
  await phoneB.expectRevealedAnswer(film.wall.wrong);
  await phoneB.expectRevealedPoints(0, film.wall.points);
}

async function playKahootRound(night: Night): Promise<void> {
  const { control, display, phoneA, phoneB } = night;
  await control.advance('round_intro');
  await revealStandings(night, {
    a: TEAM_A_AFTER_BLOCK_TWO,
    b: TEAM_B_AFTER_BLOCK_TWO,
  });
  await control.toggleLeaderboard();
  await display.expectText(quickFire.title);
  await display.expectText(quickFire.category);

  // Every kahoot question is its own block: it locks and goes straight to its reveal.
  await control.advance('question_open');
  await display.expectQuestion(quickFire.badminton.prompt);
  await phoneA.expectQuestion(quickFire.badminton.prompt);
  await tapKahootChoice(phoneA, quickFire.badminton.right);
  await tapKahootChoice(phoneB, quickFire.badminton.wrong);
  await control.advance('locking');
  await display.expectLockCountdown();
  await control.expectStatus('reveal');
  await display.expectRevealedAnswer(quickFire.badminton.right);
  await phoneA.expectRevealedPoints(
    quickFire.badminton.points,
    quickFire.badminton.points,
  );
  await phoneB.expectRevealedPoints(0, quickFire.badminton.points);

  // The next question waits behind the standings until the quiz master hides them.
  await control.advance('question_open');
  await control.toggleLeaderboard();
  await display.expectQuestion(quickFire.football.prompt);
  await answerText(night, quickFire.football.prompt, {
    a: quickFire.football.wrong,
    b: quickFire.football.right,
  });
  await control.advance('locking');
  await control.expectStatus('reveal');
  await display.expectRevealedAnswer(quickFire.football.right);
  await phoneA.expectRevealedPoints(0, quickFire.football.points);
  await phoneB.expectRevealedPoints(
    quickFire.football.points,
    quickFire.football.points,
  );
}

async function endTheNight(night: Night): Promise<void> {
  const { control, display, phoneA, phoneB } = night;
  await control.advance('ended');
  await control.revealNextLeaderboardTeam();
  await expectPodiumStep(display, phoneB.teamName, TEAM_B_FINAL);
  await phoneB.expectOwnStanding(TEAM_B_FINAL);
  await control.revealNextLeaderboardTeam();
  await expectPodiumStep(display, phoneA.teamName, TEAM_A_FINAL);
  await phoneA.expectOwnStanding(TEAM_A_FINAL);
  await control.toggleLeaderboard();
  await phoneA.expectText('You finished 1st of 2');
  await phoneB.expectText('You finished 2nd of 2');
  await snapAllScreens(night, 'ended');
  await openTeamPageFromPhone(phoneA);
}

/** The ended screen's "Our team page" link opens /team with the phone's stored code, showing the night just played and, opened, the team's own answers beside the right ones. */
async function openTeamPageFromPhone(phone: PhoneScreen): Promise<void> {
  await phone.page.getByRole('link', { name: 'Our team page' }).click();
  await expect(phone.page).toHaveURL(/\/team$/);
  await expect(
    phone.page.getByRole('heading', { name: phone.teamName, level: 1 }),
  ).toBeVisible();
  await expect(
    phone.page.getByRole('heading', { name: 'Sessions', level: 2 }),
  ).toBeVisible();

  // Team A is the only team that played here, so the table has one night.
  await phone.page.getByRole('table').getByRole('button').first().click();
  const capital = phone.page
    .getByRole('listitem')
    .filter({ hasText: warmUp.capital.prompt });
  await expect(capital).toBeVisible();
  await expect(capital.getByText('Your answer')).toBeVisible();
  await expect(capital.getByText('Right answer')).toBeVisible();
  // Team A typed the key, so its own answer and the right answer read the same.
  await expect(
    capital.getByText(warmUp.capital.key, { exact: true }),
  ).toHaveCount(2);
  await expect(capital.getByText('Correct', { exact: true })).toBeVisible();
  await expect(
    capital.getByText(`${warmUp.capital.points} / ${warmUp.capital.points}`),
  ).toBeVisible();
}

test('a whole quiz night is played across the big screen, the laptop and two phones', async ({
  control,
  display,
  joinPhone,
  session,
}) => {
  // A longer --timeout (rewriting snapshots) wins over the night's own.
  test.setTimeout(Math.max(test.info().timeout, NIGHT_TIMEOUT_MS));

  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  const night: Night = {
    control,
    display,
    phoneA,
    phoneB,
    joinCode: session.joinCode,
  };
  const teamNames = [phoneA.teamName, phoneB.teamName];
  await display.expectLobbyTeams(teamNames);
  await control.expectTeams(teamNames);
  await snapAllScreens(night, 'lobby');

  await control.startQuiz();
  await display.expectText('No cheating.');
  await phoneA.expectText('No cheating.');
  await snapAllScreens(night, 'rules');

  await control.advance('round_overview');
  await display.expectText(warmUp.title);
  await display.expectText(quickFire.title);
  await snapAllScreens(night, 'round_overview');

  await openAndPlayBlockOne(night);
  await lockBlockOne(night);
  await playFirstBreak(night);
  await walkFirstBreakReview(night);
  await revealBlockOne(night);

  await playBlockTwo(night);
  await crossBackIntoBlockOne(night);
  await revealBlockTwo(night);

  await playKahootRound(night);
  await endTheNight(night);
});
