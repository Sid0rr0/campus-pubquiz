import { NotFoundException } from '@nestjs/common';
import type { AdminQuestionContext, AnswerView } from '@campus-pubquiz/types';
import { RolesGuard } from '@/auth/roles.guard';
import { SessionGuard } from '@/auth/session.guard';
import { AnswerController } from '@/answer/answer.controller';
import {
  UnknownLiveSessionError,
  type LiveSessionRest,
} from '@/game/rest/live-session-rest.service';

function makeController() {
  const rest = { listAnswers: jest.fn() };
  const controller = new AnswerController(rest as unknown as LiveSessionRest);
  return { controller, rest };
}

const question: AdminQuestionContext = {
  type: 'free_text',
  prompt: 'Q1',
  points: 1,
  correctAnswer: 'A1',
  roundTitle: 'Round 1',
  roundNumber: 1,
  questionNumberInRound: 1,
  totalQuestionsInRound: 1,
};

const answers: AnswerView[] = [
  {
    answerId: 41,
    teamId: 31,
    teamName: 'The Quizzards',
    value: 'Banana',
    pointsAwarded: 0,
    gradedAt: null,
    gradingState: 'ungraded',
    verdict: null,
  },
];

describe('AnswerController', () => {
  it('is protected by SessionGuard + RolesGuard', () => {
    const guards = Reflect.getMetadata('__guards__', AnswerController) as
      | unknown[]
      | undefined;

    expect(guards).toContain(SessionGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('returns the question context and answers for a known question', async () => {
    const { controller, rest } = makeController();
    rest.listAnswers.mockResolvedValue({ questionId: 21, question, answers });

    const result = await controller.list('ABCDEF', 21);

    expect(rest.listAnswers).toHaveBeenCalledWith('ABCDEF', 21);
    expect(result).toEqual({ questionId: 21, question, answers });
  });

  it('404s for an unknown join code', async () => {
    const { controller, rest } = makeController();
    rest.listAnswers.mockRejectedValue(new UnknownLiveSessionError('NOPE12'));

    await expect(controller.list('NOPE12', 21)).rejects.toThrow(
      new NotFoundException('Unknown session "NOPE12"'),
    );
  });

  it('404s for an unknown question id', async () => {
    const { controller, rest } = makeController();
    rest.listAnswers.mockResolvedValue(null);

    await expect(controller.list('ABCDEF', 999)).rejects.toThrow(
      NotFoundException,
    );
  });
});
