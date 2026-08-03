import type { BlockQuestionView, GameProgress, JoinAcceptedPayload, QuestionView } from '@campus-pubquiz/types';
import { AnswerForm } from '@/app/play/answer-form';
import { QuestionPicker, type PickerRound } from '@/app/play/question-picker';

interface QuestionBrowserProps {
  progress: GameProgress;
  isAnswerable: boolean;
  team: JoinAcceptedPayload | null;
  pickerRounds: PickerRound[];
  totalPickerSlots: number;
  selectedQuestion: QuestionView | BlockQuestionView;
  myAnswers: Record<number, string>;
  onSelectQuestion: (questionId: BlockQuestionView['id']) => void;
  onSubmitAnswer: (questionId: BlockQuestionView['id'], teamId: number, value: string) => void;
}

/** The block question picker + prompt + answer form, shown while a question is open and, unless the leaderboard overlay is on, through break/reveal so teams can browse back. */
export function QuestionBrowser({
  progress,
  isAnswerable,
  team,
  pickerRounds,
  totalPickerSlots,
  selectedQuestion,
  myAnswers,
  onSelectQuestion,
  onSubmitAnswer,
}: QuestionBrowserProps) {
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
      <h1 className="text-balance font-display text-2xl leading-tight">{selectedQuestion.prompt}</h1>
      {(selectedQuestion.type === 'picture' || selectedQuestion.type === 'audio') && (
        <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">👀 Look at the screen</p>
      )}
      {isAnswerable && team && (
        <AnswerForm
          key={selectedQuestion.id}
          question={selectedQuestion}
          initialValue={myAnswers[selectedQuestion.id] ?? ''}
          onSubmit={(value) => onSubmitAnswer(selectedQuestion.id, team.teamId, value)}
        />
      )}
      {!isAnswerable && progress.status === 'break' && (
        <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">
          Answers are locked — grading in progress…
        </p>
      )}
      {!isAnswerable && progress.status === 'reveal' && (
        <p className="text-center text-sm font-extrabold tracking-wide text-foreground/55">Revealing answers…</p>
      )}
    </div>
  );
}
