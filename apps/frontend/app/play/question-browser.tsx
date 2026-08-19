import {
  extractYoutubeVideoId,
  type BlockQuestionView,
  type BlockRevealQuestionView,
  type GameProgress,
  type JoinAcceptedPayload,
  type QuestionView,
} from '@campus-pubquiz/types';
import { QuestionDisplay } from '@/app/display/question-display';
import { AnswerForm } from '@/app/play/answer-form';
import { QuestionPicker } from '@/app/play/question-picker';
import type { PickerRound } from '@/app/play/question-picker-slots';

interface QuestionBrowserProps {
  progress: GameProgress;
  isAnswerable: boolean;
  team: JoinAcceptedPayload | null;
  pickerRounds: PickerRound[];
  totalPickerSlots: number;
  selectedQuestion: QuestionView | BlockQuestionView;
  /** selectedQuestion with its correct answer attached — set only while reveal is showing this question. */
  revealQuestion?: BlockRevealQuestionView;
  myAnswers: Record<number, string>;
  onSelectQuestion: (questionId: BlockQuestionView['id']) => void;
  onSubmitAnswer: (
    questionId: BlockQuestionView['id'],
    teamId: number,
    value: string,
  ) => void;
}

/** The block question picker + prompt + answer form, shown while a question is open and, unless the leaderboard overlay is on, through break/reveal so teams can browse back. */
export function QuestionBrowser({
  progress,
  isAnswerable,
  team,
  pickerRounds,
  totalPickerSlots,
  selectedQuestion,
  revealQuestion,
  myAnswers,
  onSelectQuestion,
  onSubmitAnswer,
}: QuestionBrowserProps) {
  const myAnswer = myAnswers[selectedQuestion.id];

  return (
    <div className="flex flex-col gap-6">
      {totalPickerSlots > 1 && (
        <QuestionPicker
          pickerRounds={pickerRounds}
          selectedQuestionId={selectedQuestion.id}
          myAnswers={myAnswers}
          onSelect={onSelectQuestion}
        />
      )}
      {progress.status === 'reveal' && revealQuestion ? (
        <div className="flex flex-col items-center gap-6 text-center">
          <QuestionDisplay
            type={revealQuestion.type}
            prompt={revealQuestion.prompt}
            mediaUrl={revealQuestion.mediaUrl}
            mediaStartSeconds={revealQuestion.mediaStartSeconds}
            mediaEndSeconds={revealQuestion.mediaEndSeconds}
            options={revealQuestion.options}
            matchTargets={revealQuestion.matchTargets}
            correctAnswer={revealQuestion.answer}
            answerMediaUrl={revealQuestion.answerMediaUrl}
            mediaTestIdPrefix="play-reveal"
          />
          <p className="font-display text-lg text-magenta">
            <span className="font-body text-sm font-extrabold text-foreground/55">
              YOUR ANSWER{' '}
            </span>
            {myAnswer ?? 'No answer submitted'}
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-balance font-display text-2xl leading-tight">
            {selectedQuestion.prompt}
          </h1>
          {(selectedQuestion.type === 'picture' ||
            selectedQuestion.type === 'audio' ||
            selectedQuestion.type === 'youtube' ||
            extractYoutubeVideoId(selectedQuestion.mediaUrl ?? '') !==
              undefined) && (
            <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
              👀 Look at the screen
            </p>
          )}
          {isAnswerable && team && (
            <AnswerForm
              key={selectedQuestion.id}
              question={selectedQuestion}
              initialValue={myAnswers[selectedQuestion.id] ?? ''}
              onSubmit={(value) =>
                onSubmitAnswer(selectedQuestion.id, team.teamId, value)
              }
            />
          )}
          {!isAnswerable &&
            (progress.status === 'break_intro' ||
              progress.status === 'break' ||
              progress.status === 'break_round_intro') && (
              <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
                Answering is locked for this question
              </p>
            )}
          {!isAnswerable && progress.status === 'reveal' && (
            <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
              Revealing answers…
            </p>
          )}
        </>
      )}
    </div>
  );
}
