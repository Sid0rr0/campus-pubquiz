import {
  DEFAULT_SESSION_SETTINGS,
  type LeaderboardEntry,
} from '@campus-pubquiz/types';
import type { SeededGame } from '@/db/seed.types';
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
  arrange,
} from './test-utils';

const TWO_BLOCK_GAME: SeededGame = {
  quizId: 9,
  gameSessionId: 109,
  joinCode: 'ABCDEF',
  rounds: [
    {
      id: 91,
      title: 'Music',
      breakAfter: true,
      questions: [
        {
          id: 191,
          type: 'free_text',
          prompt: 'Band?',
          points: 1,
          answer: 'ABBA',
        },
      ],
    },
    {
      id: 92,
      title: 'Sport',
      breakAfter: true,
      questions: [
        {
          id: 192,
          type: 'free_text',
          prompt: 'Sport?',
          points: 1,
          answer: 'Golf',
        },
      ],
    },
  ],
  settings: DEFAULT_SESSION_SETTINGS,
};

const TEAM_ENTRY: LeaderboardEntry = {
  teamId: 31,
  teamName: 'The Quizzards',
  totalPoints: 2,
  bonusPoints: 0,
  positiveBonusPoints: 0,
  negativeBonusPoints: 0,
  roundPoints: [],
};

async function createService(game?: SeededGame): Promise<GameStateService> {
  const seedService = createFakeGameStateSeedService();
  if (game) seedService.seed.mockResolvedValue(game);
  const service = new GameStateService(
    asSeedService(seedService),
    asGameProgressRepository(createFakeGameProgressRepository()),
    createFakeOrm(),
    asAnswerService(createFakeAnswerService()),
    asShowdownService(createFakeShowdownService()),
  );
  await service.onModuleInit();
  return service;
}

describe('GameStateService — getPresenterContext', () => {
  const joinCode = 'ABCDEF';
  let service: GameStateService;

  async function advance(times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await service.applyAction(joinCode, 'ADVANCE');
    }
  }

  function screens() {
    const { currentScreen, nextScreen } = service.getPresenterContext(joinCode);
    return {
      current: currentScreen.heading,
      next: nextScreen?.heading ?? null,
      nextBody: nextScreen?.body,
      nextQuestionId: nextScreen?.question?.id,
    };
  }

  describe('two-round, one-block quiz', () => {
    beforeEach(async () => {
      service = await createService();
    });

    it('previews the rules screen from the lobby', () => {
      expect(screens()).toMatchObject({ current: 'Lobby', next: 'Rules' });
    });

    it('returns notes for the open question and previews the next question with its answer', async () => {
      await service.applyAction(joinCode, 'START_QUIZ');
      await advance(2); // -> round_intro(0) -> r1q1

      const context = service.getPresenterContext(joinCode);
      expect(context.currentQuestionNotes).toBe(
        'Remind teams: EU capitals only.',
      );
      expect(context.currentScreen.heading).toBe('R1 Q1');
      expect(context.nextScreen?.question).toEqual(
        expect.objectContaining({ id: 22, answer: 'Jupiter' }),
      );
    });

    it('walks every screen up to the break', async () => {
      await service.applyAction(joinCode, 'START_QUIZ');
      expect(screens()).toMatchObject({
        current: 'Rules',
        next: 'Round 1 title',
        nextBody: 'General Knowledge',
      });

      await advance(1);
      expect(screens()).toMatchObject({
        current: 'Round 1 title',
        next: 'R1 Q1',
        nextQuestionId: 21,
      });

      await advance(2); // -> r1q2, last question of a non-break round
      expect(screens()).toMatchObject({
        current: 'R1 Q2',
        next: 'Round 2 title',
        nextBody: 'Landmarks & Flags',
      });

      await advance(2); // -> round_intro(1) -> r2q1
      expect(screens()).toMatchObject({ next: 'R2 Q2', nextQuestionId: 24 });

      await advance(1); // -> r2q2, last question before the break
      expect(screens()).toMatchObject({ next: 'Locking answers' });

      await advance(1); // -> locking
      expect(screens()).toMatchObject({
        current: 'Locking answers',
        next: 'Break 1',
        nextBody: 'After round 2',
      });
    });

    it('walks from the break through every reveal to the final leaderboard', async () => {
      await service.applyAction(joinCode, 'START_QUIZ');
      await advance(8); // -> break_intro

      expect(screens()).toMatchObject({
        current: 'Break 1',
        next: 'Revealing · Round 1 title',
        nextBody: 'General Knowledge',
      });

      await advance(1); // -> reveal_intro(0)
      expect(screens()).toMatchObject({
        next: 'Revealing R1 Q1',
        nextBody: 'Capital of France? — Answer: Paris',
      });

      await advance(1); // -> reveal R1 Q1
      expect(screens()).toMatchObject({
        current: 'Revealing R1 Q1',
        next: 'Revealing R1 Q2',
      });

      await advance(1); // -> reveal R1 Q2, last of round 1
      expect(screens()).toMatchObject({
        next: 'Revealing · Round 2 title',
        nextBody: 'Landmarks & Flags',
      });

      await advance(3); // -> reveal_intro(2) -> R2 Q1 -> R2 Q2
      expect(screens()).toMatchObject({
        current: 'Revealing R2 Q2',
        next: 'Leaderboard',
        nextBody: 'Final standings',
      });

      arrange(service).setLeaderboard(joinCode, [TEAM_ENTRY]);
      await advance(1); // -> ended, final leaderboard
      expect(screens()).toMatchObject({
        current: 'Leaderboard',
        next: 'Leaderboard',
        nextBody: 'Next place (1 of 1)',
      });

      await service.applyAction(joinCode, 'REVEAL_NEXT_TEAM');
      expect(screens()).toMatchObject({ next: 'Quiz complete!' });
    });
  });

  describe('two-block quiz', () => {
    beforeEach(async () => {
      service = await createService(TWO_BLOCK_GAME);
    });

    it("previews the leaderboard after a block's last reveal, then the next round's title once every team is shown", async () => {
      await service.applyAction(joinCode, 'START_QUIZ');
      await advance(6); // round_intro, q1, locking, break_intro, reveal_intro, reveal
      arrange(service).setLeaderboard(joinCode, [TEAM_ENTRY]);

      expect(screens()).toMatchObject({
        current: 'Revealing R1 Q1',
        next: 'Leaderboard',
        nextBody: undefined,
      });

      await advance(1); // -> leaderboard over round_intro(1)
      expect(screens()).toMatchObject({
        current: 'Leaderboard',
        nextBody: 'Next place (1 of 1)',
      });

      await service.applyAction(joinCode, 'REVEAL_NEXT_TEAM');
      expect(screens()).toMatchObject({
        next: 'Round 2 title',
        nextBody: 'Sport',
      });
    });
  });
});
