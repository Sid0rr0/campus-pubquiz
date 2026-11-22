import type {
  BlockQuestionView,
  DoubledRoundView,
  PlayersStatePayload,
  PurchaseView,
  QuestionView,
} from '@campus-pubquiz/types';
import type { MyAnswer } from '@/app/lib/team-link';
import type { OpenedQuestionEntry } from '@/app/play/opened-questions';

interface SelectedQuestionViewInput {
  view: Pick<
    PlayersStatePayload,
    'phoneScreen' | 'blockQuestions' | 'isAnswerable'
  >;
  myAnswers: Readonly<Partial<Record<number, MyAnswer>>>;
  myJokerExtras: Readonly<Record<number, number>>;
  myDoubledRounds: readonly DoubledRoundView[];
  myPurchases: readonly PurchaseView[];
  openedQuestions: readonly OpenedQuestionEntry[];
  selectedQuestion: QuestionView | BlockQuestionView | null;
}

export type SelectedQuestionView = NonNullable<
  ReturnType<typeof selectedQuestionViewOf>
>;

/** Everything the phone shows about the selected question for this team, worked out once; null with no selection. */
export function selectedQuestionViewOf({
  view,
  myAnswers,
  myJokerExtras,
  myDoubledRounds,
  myPurchases,
  openedQuestions,
  selectedQuestion,
}: SelectedQuestionViewInput) {
  if (!selectedQuestion) return null;
  const { id } = selectedQuestion;
  const answer = myAnswers[id];
  const roundNumber = view.blockQuestions.find(
    (question) => question.id === id,
  )?.roundNumber;
  return {
    question: selectedQuestion,
    answer: answer?.value,
    clue: answer?.clue ?? null,
    ...resultOf(
      openedQuestions.find((candidate) => candidate.id === id),
      myJokerExtras,
    ),
    isDoubledRound: myDoubledRounds.some(
      (round) => round.roundNumber === roundNumber,
    ),
    purchases: myPurchases.filter((purchase) => purchase.questionId === id),
    isAnsweringNow: isAnsweringNowOn(view),
  };
}

/** Points, verdict and joker extra as the opened entry shows them (only once revealed, as the history panel does); all null for a question not opened. */
function resultOf(
  entry: OpenedQuestionEntry | undefined,
  jokerExtras: SelectedQuestionViewInput['myJokerExtras'],
) {
  return {
    points: entry?.pointsAwarded ?? null,
    verdict: entry?.verdict ?? null,
    jokerExtra: entry ? (jokerExtras[entry.id] ?? null) : null,
  };
}

/** Whether the selected question is the one being answered right now: the block Phone screen, in answering mode, while answerable. */
function isAnsweringNowOn({
  phoneScreen,
  isAnswerable,
}: SelectedQuestionViewInput['view']) {
  return (
    phoneScreen.kind === 'block' &&
    phoneScreen.mode === 'answering' &&
    isAnswerable
  );
}
