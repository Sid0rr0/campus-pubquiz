import type { JoinPhone } from '../fixtures';
import type { ControlScreen } from './screens/control-screen';
import type { PhoneScreen } from './screens/phone-screen';

export interface TwoTeams {
  phoneA: PhoneScreen;
  phoneB: PhoneScreen;
}

/** Joins Team A and Team B, starts the quiz and opens the first question on the quiz master's laptop. */
export async function startWithTwoTeams(
  control: ControlScreen,
  joinPhone: JoinPhone,
): Promise<TwoTeams> {
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.startQuiz();
  await control.advance('round_intro');
  await control.advance('question_open');
  return { phoneA, phoneB };
}
