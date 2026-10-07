import { describe, expect, it } from 'vitest';
import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import { buildSessionState, roomView } from '@/test-utils/room-view';

describe('room view fixture builder', () => {
  it.each([SOCKET_ROOMS.DISPLAY, SOCKET_ROOMS.ADMIN, SOCKET_ROOMS.PLAYERS])(
    'gives the %s room a valid lobby view when nothing is described',
    (room) => {
      const view = roomView(room, {});

      expect(view.progress.status).toBe('lobby');
      expect(view.blockQuestions).toEqual([]);
    },
  );

  it('gives phones an answerable view with the open question in the block', () => {
    const description = {
      rounds: [{ questions: [{ id: 7, prompt: 'Capital of France?' }] }],
      progress: { status: 'question_open' as const },
    };

    const view = roomView(SOCKET_ROOMS.PLAYERS, description);

    expect(view.isAnswerable).toBe(true);
    expect(view.blockQuestions.map((q) => q.id)).toEqual([7]);
  });

  it('makes the admin Advance step a reveal step under the leaderboard with a reveal count', () => {
    const description = {
      progress: { status: 'break' as const, isLeaderboardVisible: true },
      leaderboard: [
        { teamName: 'Red', totalPoints: 5 },
        { teamName: 'Blue', totalPoints: 3 },
      ],
      leaderboardRevealCount: 1,
    };

    const view = roomView(SOCKET_ROOMS.ADMIN, description);

    expect(view.advanceStep).toMatch(/reveal/);
  });

  it('numbers questions uniquely across rounds when ids are left out', () => {
    const state = buildSessionState({
      rounds: [{ questions: [{}, {}] }, { questions: [{}] }],
    });

    const ids = state.seededGame.rounds.flatMap((r) =>
      r.questions.map((q) => q.id),
    );
    expect(new Set(ids).size).toBe(3);
  });
});
