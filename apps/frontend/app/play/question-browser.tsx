import {
  formatAnswer,
  isHttpUrl,
  optionsAfterPurchases,
  pinFor,
  POWER_UP_LABELS,
  widenedMargin,
} from '@campus-pubquiz/types';
import type {
  BlockMode,
  BlockQuestionView,
  PlayersRevealQuestionView,
  JoinAcceptedPayload,
  QuestionView,
  Verdict,
} from '@campus-pubquiz/types';
import { yourAnswerTextClass } from '@/app/play/verdict-card';
import { NumberMarginText } from '@/app/components/number-margin-text';
import { QuestionDisplay } from '@/app/display/question-display';
import {
  ClosestGuessRevealScreen,
  closestGuessAnswerProps,
} from '@/app/components/closest-guess-reveal-screen';
import { Button } from '@/app/components/button';
import { AnswerForm } from '@/app/play/answer-form';
import {
  PowerUpBar,
  RoomSplit,
  type PowerUpShop,
} from '@/app/play/power-up-bar';
import { QuestionPicker } from '@/app/play/question-picker';
import type { PickerRound } from '@/app/play/question-picker-slots';

interface QuestionNavigation {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

interface QuestionBrowserProps {
  /** The block Phone screen's mode: the only thing that picks the reveal body, the answer form and the locked/revealing lines. */
  mode: BlockMode;
  /** False while the phone isn't linked to a team, whatever the mode. */
  isAnswerable: boolean;
  team: JoinAcceptedPayload | null;
  pickerRounds: PickerRound[];
  totalPickerSlots: number;
  selectedQuestion: QuestionView | BlockQuestionView;
  /** selectedQuestion as the reveal has shown it so far — set only while reveal is showing this question; a closest_guess question has no answer until its answer step. */
  revealQuestion?: PlayersRevealQuestionView;
  /** Active round's Kahoot-style speed scoring flag — tap-to-submit, single shot, for multiple_choice only. */
  isKahootMode: boolean;
  myAnswers: Record<number, string>;
  /** Points awarded for the selected question's answer, null until graded. */
  myAnswerPoints: number | null;
  /** How the selected question's answer was judged, null until graded; colours "Your answer" on the reveal. */
  myAnswerVerdict: Verdict | null;
  /** The extra points the joker adds to this answer ("+1"), null outside the joker round. */
  myAnswerJokerExtra?: number | null;
  onSelectQuestion: (questionId: BlockQuestionView['id']) => void;
  onSubmitAnswer: (
    questionId: BlockQuestionView['id'],
    teamId: number,
    value: string,
  ) => void;
  /** Set only when the team has turned off auto-advance — renders Prev/Next controls bounded to questions already opened. */
  navigation?: QuestionNavigation;
  /** Whether the selected question belongs to the team's joker round — its answers count double, so the browser wears a joker border. */
  isJokerQuestion?: boolean;
  /** Set when the team can spend coins: draws the power-up bar and hides the options its 50/50s removed. */
  powerUpShop?: PowerUpShop;
}

interface RevealBodyProps {
  revealQuestion: PlayersRevealQuestionView;
  myAnswer: string;
}

/** The revealed question as its reveal kind lays it out; both closest-guess kinds draw the closest-guess sequence, but only `closest_guess` carries the correct answer. */
function RevealBody({ revealQuestion, myAnswer }: RevealBodyProps) {
  switch (revealQuestion.revealKind) {
    case 'closest_guess':
    case 'closest_guess_pending':
      return (
        <ClosestGuessRevealScreen
          prompt={revealQuestion.prompt}
          closestGuess={revealQuestion.closestGuess}
          mediaTestIdPrefix="play-reveal"
          {...closestGuessAnswerProps(revealQuestion)}
        />
      );
    case 'answer':
      return (
        <QuestionDisplay
          question={revealQuestion}
          isMediaHidden
          playerAnswer={myAnswer}
          mediaTestIdPrefix="play-reveal"
          promptClassName="text-balance font-display text-2xl leading-tight"
        />
      );
    default: {
      const unhandled: never = revealQuestion;
      return unhandled;
    }
  }
}

/** The block question picker + prompt + answer form, shown while a question is open and, unless the leaderboard overlay is on, through break/reveal so teams can browse back. */
export function QuestionBrowser({
  mode,
  isAnswerable,
  team,
  pickerRounds,
  totalPickerSlots,
  selectedQuestion,
  revealQuestion,
  isKahootMode,
  myAnswers,
  myAnswerPoints,
  myAnswerVerdict,
  myAnswerJokerExtra = null,
  onSelectQuestion,
  onSubmitAnswer,
  navigation,
  isJokerQuestion = false,
  powerUpShop,
}: QuestionBrowserProps) {
  const myAnswer = myAnswers[selectedQuestion.id];
  // A 50/50 hides its removed options for good, so a reconnect shows the same choices.
  const answerableQuestion =
    powerUpShop && selectedQuestion.options
      ? {
          ...selectedQuestion,
          options: optionsAfterPurchases(
            selectedQuestion.id,
            selectedQuestion.options,
            powerUpShop.purchases,
          ),
        }
      : selectedQuestion;

  return (
    <div
      data-testid={isJokerQuestion ? 'joker-border' : undefined}
      className={`flex flex-col gap-6 ${
        isJokerQuestion ? 'rounded-2xl border-4 border-yellow p-4' : ''
      }`}
    >
      {navigation && (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline-muted"
            size="sm"
            disabled={!navigation.canGoBack}
            onClick={navigation.onBack}
          >
            ← Prev
          </Button>
          <Button
            type="button"
            variant="outline-muted"
            size="sm"
            disabled={!navigation.canGoForward}
            onClick={navigation.onForward}
          >
            Next →
          </Button>
        </div>
      )}
      {totalPickerSlots > 1 && (
        <div className="order-last md:order-0">
          <QuestionPicker
            pickerRounds={pickerRounds}
            selectedQuestionId={selectedQuestion.id}
            myAnswers={myAnswers}
            onSelect={onSelectQuestion}
          />
        </div>
      )}
      {mode === 'revealing' && revealQuestion ? (
        <div className="flex flex-col items-center gap-6 text-center">
          <RevealBody
            revealQuestion={revealQuestion}
            myAnswer={myAnswer ?? ''}
          />
          <p
            className={`font-display text-2xl ${yourAnswerTextClass({
              myAnswer: myAnswer || null,
              pointsAwarded: myAnswerPoints,
              verdict: myAnswerVerdict,
            })}`}
          >
            <span className="font-body text-md font-extrabold text-foreground/55">
              Your answer{': '}
            </span>
            {myAnswer
              ? formatAnswer(myAnswer, {
                  type: revealQuestion.type,
                  options: revealQuestion.options,
                })
              : 'No answer submitted'}
          </p>
          {myAnswerPoints !== null && (
            <p className="font-body text-3xl font-extrabold text-foreground/55">
              {myAnswerPoints} / {revealQuestion.points} points
              {myAnswerJokerExtra !== null && (
                <span className="ml-2 whitespace-nowrap text-foreground">
                  {`🃏 +${myAnswerJokerExtra}`}
                </span>
              )}
            </p>
          )}
        </div>
      ) : (
        <>
          <h1 className="text-balance font-display text-2xl leading-tight">
            {selectedQuestion.prompt}
          </h1>
          <NumberMarginText
            question={
              selectedQuestion.margin &&
              powerUpShop?.purchases.some(
                (p) =>
                  p.effect.kind === 'wider_margin' &&
                  p.questionId === selectedQuestion.id,
              )
                ? { margin: widenedMargin(selectedQuestion.margin) }
                : selectedQuestion
            }
            className="text-center text-sm font-extrabold tracking-wide text-foreground/55"
          />
          {isHttpUrl(selectedQuestion.mediaUrl ?? '') && (
            <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
              {selectedQuestion.isVideoHidden
                ? '🎧 Listen'
                : '👀 Look at the screen'}
            </p>
          )}
          {myAnswer && (
            <p className="text-center text-lg font-extrabold tracking-wide">
              <span className="text-foreground/55">Submitted: </span>
              {formatAnswer(myAnswer, {
                type: selectedQuestion.type,
                options: selectedQuestion.options,
              })}
            </p>
          )}
          {powerUpShop?.purchases.map(
            ({ questionId, effect }) =>
              questionId === selectedQuestion.id &&
              'hint' in effect && (
                <p
                  key={effect.kind}
                  className="text-center font-mono text-lg font-extrabold tracking-widest"
                >
                  {POWER_UP_LABELS[effect.kind]}: {effect.hint}
                </p>
              ),
          )}
          {mode === 'answering' && isAnswerable && team && powerUpShop && (
            <PowerUpBar question={selectedQuestion} shop={powerUpShop} />
          )}
          {mode === 'answering' && isAnswerable && team && powerUpShop && (
            <RoomSplit
              question={selectedQuestion}
              purchases={powerUpShop.purchases}
            />
          )}
          {mode === 'answering' && isAnswerable && team && (
            <AnswerForm
              key={selectedQuestion.id}
              question={answerableQuestion}
              initialValue={myAnswers[selectedQuestion.id] ?? ''}
              isKahootMode={isKahootMode}
              pin={
                powerUpShop &&
                pinFor(selectedQuestion.id, powerUpShop.purchases)
              }
              onSubmit={(value) =>
                onSubmitAnswer(selectedQuestion.id, team.teamId, value)
              }
            />
          )}
          {mode === 'locked' && (
            <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
              Answering is locked for this question
            </p>
          )}
          {mode === 'revealing' && (
            <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
              Revealing answers…
            </p>
          )}
        </>
      )}
    </div>
  );
}
