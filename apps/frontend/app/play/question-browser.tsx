import {
  clueFreezeState,
  formatAnswer,
  isHttpUrl,
  isNonAnswer,
  isPinOffPlace,
  removedOptionsOf,
  resolveAnswerKind,
  pinFor,
  POWER_UP_LABELS,
  widenedMargin,
} from '@campus-pubquiz/types';
import type {
  BlockMode,
  BlockQuestionView,
  PlayersRevealQuestionView,
  JoinAcceptedPayload,
  PurchaseView,
  QuestionView,
  Verdict,
} from '@campus-pubquiz/types';
import type { MyAnswerClue } from '@/app/lib/team-link';
import { yourAnswerTextClass } from '@/app/play/verdict-card';
import { ClueList } from '@/app/components/clue-list';
import { NumberMarginText } from '@/app/components/number-margin-text';
import { QuestionDisplay } from '@/app/display/question-display';
import {
  ClosestGuessRevealScreen,
  closestGuessAnswerProps,
} from '@/app/components/closest-guess-reveal-screen';
import { Button } from '@/app/components/button';
import { AnswerForm } from '@/app/play/answer-form';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { RoomSplit } from '@/app/play/power-up-bar';
import { QuestionPicker } from '@/app/play/question-picker';
import type { PickerRound } from '@/app/play/question-picker-slots';

/** How a bought hint or room split arrives: after the stamp has landed and the drawer has cleared. */
const POWER_UP_EFFECT_ARRIVAL = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.3, duration: 0.3, ease: [0.16, 1, 0.3, 1] },
} as const;

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
  /** Active round's quickfire speed scoring flag — tap-to-submit, single shot, for multiple_choice only. */
  isQuickfireMode: boolean;
  myAnswers: Record<number, string>;
  /** The clue the selected Clue question's answer was locked in on and what it is worth there, once sent. */
  myAnswerClue?: MyAnswerClue;
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
  /** The numbers of the rounds doubled for the team, marked in the picker. */
  doubledRoundNumbers?: readonly number[];
  /** The team's own power-up purchases: their effects show on the question, whatever the coins left. */
  purchases?: PurchaseView[];
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
  isQuickfireMode,
  myAnswers,
  myAnswerClue,
  myAnswerPoints,
  myAnswerVerdict,
  myAnswerJokerExtra = null,
  onSelectQuestion,
  onSubmitAnswer,
  navigation,
  isJokerQuestion = false,
  doubledRoundNumbers = [],
  purchases = [],
}: QuestionBrowserProps) {
  const myAnswer = myAnswers[selectedQuestion.id];
  const verdictTextClass = yourAnswerTextClass({
    myAnswer: myAnswer || null,
    pointsAwarded: myAnswerPoints,
    verdict: myAnswerVerdict,
  });

  return (
    <div
      data-testid={isJokerQuestion ? 'joker-border' : undefined}
      className={`flex flex-col gap-6 ${
        isJokerQuestion ? 'rounded-2xl border-4 border-yellow p-4' : ''
      }`}
    >
      {navigation && <PrevNextNav navigation={navigation} />}
      {totalPickerSlots > 1 && (
        <div className="order-last md:order-0">
          <QuestionPicker
            pickerRounds={pickerRounds}
            doubledRoundNumbers={doubledRoundNumbers}
            selectedQuestionId={selectedQuestion.id}
            myAnswers={myAnswers}
            onSelect={onSelectQuestion}
          />
        </div>
      )}
      {mode === 'revealing' && revealQuestion ? (
        <RevealedAnswer
          revealQuestion={revealQuestion}
          myAnswer={myAnswer}
          myAnswerClue={myAnswerClue}
          myAnswerPoints={myAnswerPoints}
          myAnswerJokerExtra={myAnswerJokerExtra}
          verdictTextClass={verdictTextClass}
        />
      ) : (
        <OpenQuestion
          mode={mode}
          isAnswerable={isAnswerable}
          team={team}
          question={selectedQuestion}
          myAnswer={myAnswer}
          myAnswerClue={myAnswerClue}
          isQuickfireMode={isQuickfireMode}
          onSubmitAnswer={onSubmitAnswer}
          purchases={purchases}
        />
      )}
    </div>
  );
}

/** A Clue question's clues shown so far and what an answer is worth now. */
function CluesShown({
  question,
}: {
  question: QuestionBrowserProps['selectedQuestion'];
}) {
  return (
    <>
      {question.clues && <ClueList clues={question.clues} />}
      {question.clueValue !== undefined && (
        <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
          Worth {question.clueValue} points now
        </p>
      )}
    </>
  );
}

/** A Clue answer a newer clue has frozen, shown read-only in place of the answer form. */
function FrozenAnswer({ clue, value }: MyAnswerClue) {
  return (
    <p className="text-center text-lg font-extrabold text-magenta">
      Locked in on clue {clue} · worth {value} points
    </p>
  );
}

/** The answer form, or a Clue answer a newer clue froze; a Clue question warns next to Send while the answer could still freeze. */
function AnswerArea({
  question,
  isAnswerable,
  initialValue,
  removedOptions,
  isQuickfireMode,
  pin,
  myAnswerClue,
  myAnswer,
  onSubmit,
}: {
  question: QuestionBrowserProps['selectedQuestion'];
  isAnswerable: boolean;
  initialValue: string;
  removedOptions: ReturnType<typeof removedOptionsOf>;
  isQuickfireMode: boolean;
  pin: ReturnType<typeof pinFor>;
  myAnswerClue: MyAnswerClue | undefined;
  myAnswer: string | undefined;
  onSubmit: (value: string) => void;
}) {
  const { isFrozen, isFreezable } = clueFreezeState(
    question,
    { value: myAnswer, clue: myAnswerClue?.clue },
    question.highestClue,
  );
  if (isFrozen && myAnswerClue) {
    return <FrozenAnswer {...myAnswerClue} />;
  }
  return (
    // Hidden, not unmounted, while the phone is unlinked (a reconnect after the phone slept): the half-typed answer or dragged order survives until it is linked again.
    <div hidden={!isAnswerable}>
      <AnswerForm
        // A Clue question's form restarts when its answer is cleared, so the box doesn't keep the cleared text.
        key={
          isFreezable
            ? `${question.id}:${isNonAnswer(initialValue)}`
            : question.id
        }
        question={question}
        // A 50/50 greys its removed options out for good, so a reconnect shows the same choices.
        removedOptions={removedOptions}
        initialValue={initialValue}
        isQuickfireMode={isQuickfireMode}
        pin={pin}
        onSubmit={onSubmit}
      />
      {isFreezable && (
        <>
          <p className="mt-2 text-center text-sm font-extrabold text-foreground/55">
            Once the next clue is shown, you can&apos;t change this answer.
          </p>
          {!isNonAnswer(initialValue) && (
            <Button
              type="button"
              onClick={() => onSubmit('')}
              className="mt-2 flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-dashed border-foreground/35 bg-transparent px-4 text-base font-extrabold text-foreground/55"
            >
              Clear my answer
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** The selected question as asked: its prompt, notes, power-up hints and, while answering, the answer form. */
function OpenQuestion({
  mode,
  isAnswerable,
  team,
  question,
  myAnswer,
  myAnswerClue,
  isQuickfireMode,
  onSubmitAnswer,
  purchases,
}: Pick<
  QuestionBrowserProps,
  | 'mode'
  | 'isAnswerable'
  | 'team'
  | 'isQuickfireMode'
  | 'onSubmitAnswer'
  | 'myAnswerClue'
> & {
  question: QuestionBrowserProps['selectedQuestion'];
  myAnswer: string | undefined;
  purchases: NonNullable<QuestionBrowserProps['purchases']>;
}) {
  const hasWiderMargin = purchases.some(
    (p) => p.effect.kind === 'wider_margin' && p.questionId === question.id,
  );
  const pin = pinFor(question.id, purchases);
  const isAnswering = mode === 'answering' && isAnswerable;
  return (
    <>
      <h1 className="text-balance font-display text-2xl leading-tight">
        {question.prompt}
      </h1>
      <CluesShown question={question} />
      <NumberMarginText
        question={
          question.margin && hasWiderMargin
            ? { margin: widenedMargin(question.margin) }
            : question
        }
        className="text-center text-sm font-extrabold tracking-wide text-foreground/55"
      />
      <QuestionNotes
        question={question}
        myAnswer={myAnswer}
        pin={pin}
        isAnswering={isAnswering}
      />
      <PowerUpEffects
        question={question}
        purchases={purchases}
        isRoomSplitShown={isAnswering && team !== null}
      />
      {mode === 'answering' && team && (
        <AnswerArea
          question={question}
          isAnswerable={isAnswerable}
          initialValue={myAnswer ?? ''}
          removedOptions={removedOptionsOf(question.id, purchases)}
          isQuickfireMode={isQuickfireMode}
          pin={pin}
          myAnswerClue={myAnswerClue}
          myAnswer={myAnswer}
          onSubmit={(value) => onSubmitAnswer(question.id, team.teamId, value)}
        />
      )}
      <ModeNote mode={mode} />
    </>
  );
}

/** The resubmit nudge, the media hint and the answer already sent. */
function QuestionNotes({
  question,
  myAnswer,
  pin,
  isAnswering,
}: {
  question: QuestionBrowserProps['selectedQuestion'];
  myAnswer: string | undefined;
  pin: ReturnType<typeof pinFor>;
  isAnswering: boolean;
}) {
  // A pin snaps its item into place on the phone, but the answer already sent keeps the old order.
  // The server grades a wider margin at once, but a pin changes the order only when it is sent again.
  const hasPinOffPlace =
    myAnswer !== undefined &&
    isPinOffPlace(resolveAnswerKind(question), myAnswer, pin);
  return (
    <>
      {hasPinOffPlace && isAnswering && (
        <p className="text-center text-sm font-extrabold text-magenta">
          Submit again to send the pinned order.
        </p>
      )}
      {isHttpUrl(question.mediaUrl ?? '') && (
        <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
          {question.isVideoHidden ? '🎧 Listen' : '👀 Look at the screen'}
        </p>
      )}
      {myAnswer && (
        <p className="text-center text-lg font-extrabold tracking-wide">
          <span className="text-foreground/55">Submitted: </span>
          {formatAnswer(myAnswer, {
            type: question.type,
            options: question.options,
          })}
        </p>
      )}
    </>
  );
}

const MODE_NOTES: Partial<Record<QuestionBrowserProps['mode'], string>> = {
  locked: 'Answering is locked for this question',
  revealing: 'Revealing answers…',
};

function ModeNote({ mode }: { mode: QuestionBrowserProps['mode'] }) {
  const note = MODE_NOTES[mode];
  return note ? (
    <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
      {note}
    </p>
  ) : null;
}

function PrevNextNav({
  navigation,
}: {
  navigation: NonNullable<QuestionBrowserProps['navigation']>;
}) {
  return (
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
  );
}

function RevealedAnswer({
  revealQuestion,
  myAnswer,
  myAnswerClue,
  myAnswerPoints,
  myAnswerJokerExtra,
  verdictTextClass,
}: {
  revealQuestion: NonNullable<QuestionBrowserProps['revealQuestion']>;
  myAnswer: string | undefined;
  myAnswerClue: MyAnswerClue | undefined;
  myAnswerPoints: QuestionBrowserProps['myAnswerPoints'];
  myAnswerJokerExtra: QuestionBrowserProps['myAnswerJokerExtra'];
  verdictTextClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <RevealBody revealQuestion={revealQuestion} myAnswer={myAnswer ?? ''} />
      <p className={`font-display text-2xl ${verdictTextClass}`}>
        <span className="font-body text-base font-extrabold text-foreground/55">
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
        <p
          className={`font-body text-3xl font-extrabold tabular-nums ${verdictTextClass}`}
        >
          {myAnswerPoints} / {revealQuestion.points} points
          {myAnswerJokerExtra !== null && (
            <span className="ml-2 whitespace-nowrap text-foreground">
              {`🃏 +${myAnswerJokerExtra}`}
            </span>
          )}
        </p>
      )}
      {myAnswerClue !== undefined && (
        <p className="text-sm font-extrabold text-foreground/55">
          You answered on clue {myAnswerClue.clue}
        </p>
      )}
    </div>
  );
}

/** The hints a bought power-up shows on this question, and the Ask the room split. */
function PowerUpEffects({
  question,
  purchases,
  isRoomSplitShown,
}: {
  question: QuestionBrowserProps['selectedQuestion'];
  purchases: NonNullable<QuestionBrowserProps['purchases']>;
  isRoomSplitShown: boolean;
}) {
  return (
    <MotionConfig reducedMotion="user">
      {/* Keyed by question and initial={false}: only an effect bought here and now eases in, never one already there on a load or when moving between questions. */}
      <AnimatePresence key={question.id} initial={false}>
        {purchases.map(
          ({ questionId, effect }) =>
            questionId === question.id &&
            'hint' in effect && (
              <motion.p
                key={effect.kind}
                {...POWER_UP_EFFECT_ARRIVAL}
                className="text-center font-mono text-lg font-extrabold tracking-widest"
              >
                {POWER_UP_LABELS[effect.kind]}: {effect.hint}
              </motion.p>
            ),
        )}
        {isRoomSplitShown &&
          purchases.some(
            (p) =>
              p.questionId === question.id && p.effect.kind === 'ask_the_room',
          ) && (
            <motion.div key="room-split" {...POWER_UP_EFFECT_ARRIVAL}>
              <RoomSplit question={question} purchases={purchases} />
            </motion.div>
          )}
      </AnimatePresence>
    </MotionConfig>
  );
}
