import { SOCKET_ROOMS, type SocketRoomName } from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const HIDDEN_PROMPT = 'Largest planet?';
const FIRST_PROMPT = 'Capital of France?';

describe('Screen projection — a kahoot round, per audience', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({ kahootMode: true });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
  });

  function serializedView(room: SocketRoomName): string {
    return JSON.stringify(game.gameState.getView(game.joinCode, room));
  }

  async function openSecondQuestionBehindLeaderboard() {
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> reveal
    await game.act('ADVANCE'); // -> question_open q1 behind the leaderboard
  }

  it('shows every audience the open question before any leaderboard is up', () => {
    for (const room of Object.values(SOCKET_ROOMS)) {
      expect(serializedView(room)).toContain(FIRST_PROMPT);
    }
  });

  it('omits the hidden question from the players view, both as current and block question', async () => {
    await openSecondQuestionBehindLeaderboard();

    const players = game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);

    expect(players.progress.status).toBe('question_open');
    expect(players.currentQuestion).toBeNull();
    expect(players.blockQuestions).toEqual([]);
    expect(serializedView(SOCKET_ROOMS.PLAYERS)).not.toContain(HIDDEN_PROMPT);
  });

  it('keeps the hidden question in the display and admin views', async () => {
    await openSecondQuestionBehindLeaderboard();

    for (const room of [SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.ADMIN]) {
      const view = game.gameState.getView(game.joinCode, room);
      expect(view.currentQuestion?.prompt).toBe(HIDDEN_PROMPT);
      expect(view.blockQuestions?.map((question) => question.prompt)).toEqual([
        HIDDEN_PROMPT,
      ]);
    }
  });

  it('gives the players view the question again once the leaderboard is dismissed', async () => {
    await openSecondQuestionBehindLeaderboard();

    await game.act('TOGGLE_LEADERBOARD');

    const players = game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS);
    expect(players.currentQuestion?.prompt).toBe(HIDDEN_PROMPT);
    expect(players.blockQuestions?.map((question) => question.prompt)).toEqual([
      HIDDEN_PROMPT,
    ]);
  });

  it('leaves the players view carrying the whole snapshot whenever nothing is hidden', () => {
    expect(
      game.gameState.getView(game.joinCode, SOCKET_ROOMS.PLAYERS),
    ).toMatchObject(game.gameState.getSnapshot(game.joinCode));
  });
});
