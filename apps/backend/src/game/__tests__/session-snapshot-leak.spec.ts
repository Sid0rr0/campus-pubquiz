import { GameStateService } from '@/game/state/game-state.service';
import {
  createFakeOrm,
  createFakeGameProgressRepository,
  createFakeGameStateSeedService,
  createFakeAnswerService,
  asSeedService,
  asGameProgressRepository,
  asAnswerService,
  createFakeShowdownService,
  asShowdownService,
} from './test-utils';

// Regression test for the leak this feature's design doc explicitly calls
// out: toRevealQuestionViews (block-questions.util.ts) builds
// revealQuestions/pastRevealedQuestions via a blind `{...question}` spread,
// not a field whitelist. If a question's host-only note or the presenter's
// next-question preview were ever stored *on* a question object (instead of
// SeededRound.questionNotesById, a sibling field never spread into a view),
// it would leak into the tri-room broadcast snapshot — reaching /display and
// every connected phone. Asserted on the serialized JSON, not just types,
// since this is a runtime spread issue types can't catch.
describe('buildSnapshot — presenter-only content never leaks into the broadcast payload', () => {
  const joinCode = 'ABCDEF';
  let service: GameStateService;

  beforeEach(async () => {
    service = new GameStateService(
      asSeedService(createFakeGameStateSeedService()),
      asGameProgressRepository(createFakeGameProgressRepository()),
      createFakeOrm(),
      asAnswerService(createFakeAnswerService()),
      asShowdownService(createFakeShowdownService()),
    );
    await service.onModuleInit();
  });

  it('never contains note text or a "questionNotesById"/"nextQuestion" key at any point across the whole quiz', async () => {
    const actions = [
      'START_QUIZ',
      'ADVANCE', // round_intro(0)
      'ADVANCE', // r1q1 — currentQuestion
      'ADVANCE', // r1q2
      'ADVANCE', // round_intro(1)
      'ADVANCE', // r2q1
      'ADVANCE', // r2q2
      'ADVANCE', // locking
      'ADVANCE', // break_intro — blockQuestions now the full, just-locked block
      'ADVANCE', // reveal_intro
      'ADVANCE', // reveal — revealQuestions populated
    ] as const;

    for (const action of actions) {
      const snapshot = await service.applyAction(joinCode, action);
      const serialized = JSON.stringify(snapshot);

      expect(serialized).not.toContain('Remind teams: EU capitals only.');
      expect(serialized).not.toContain('questionNotesById');
      expect(serialized).not.toContain('nextQuestion');
    }
  });
});
