import type {
  ImportQuestionPreview,
  ImportRoundPreview,
  QuestionType,
  QuizDraftSaveRequest,
} from '@campus-pubquiz/types';

export interface EditorOption {
  text: string;
  isCorrect: boolean;
}

/** One question's editable fields. `options` is only meaningful for `multiple_choice`; `correctText` holds the answer for the other three types. */
export interface EditorQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  notes: string;
  options: EditorOption[];
  correctText: string;
  mediaUrl: string;
  answerMediaUrl: string;
}

export interface EditorRound {
  id: string;
  title: string;
  breakAfter: boolean;
  questions: EditorQuestion[];
}

export function makeOption(text = ''): EditorOption {
  return { text, isCorrect: false };
}

export function makeQuestion(id: string): EditorQuestion {
  return {
    id,
    type: 'multiple_choice',
    prompt: '',
    points: 1,
    notes: '',
    options: [makeOption(), makeOption()],
    correctText: '',
    mediaUrl: '',
    answerMediaUrl: '',
  };
}

export function makeRound(id: string, title = ''): EditorRound {
  return { id, title, breakAfter: false, questions: [] };
}

/** Converts a saved/imported question into editable state — marks whichever multiple-choice option matches `answer` as correct. */
export function questionFromPreview(
  id: string,
  question: ImportQuestionPreview,
): EditorQuestion {
  const isMc = question.type === 'multiple_choice';
  return {
    id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    notes: question.notes ?? '',
    options:
      isMc && question.options
        ? question.options.map((text) => ({ text, isCorrect: text === question.answer }))
        : [makeOption(), makeOption()],
    correctText: isMc ? '' : question.answer,
    mediaUrl: question.mediaUrl ?? '',
    answerMediaUrl: question.answerMediaUrl ?? '',
  };
}

export function roundFromPreview(
  id: string,
  round: ImportRoundPreview,
  makeQuestionId: (questionIndex: number) => string,
): EditorRound {
  return {
    id,
    title: round.title,
    breakAfter: round.breakAfter,
    questions: round.questions.map((question, index) =>
      questionFromPreview(makeQuestionId(index), question),
    ),
  };
}

/** Converts editable state back into the API shape — derives `answer` from whichever option is marked correct, trims text, and drops blank optional fields. */
export function questionToPreview(question: EditorQuestion): ImportQuestionPreview {
  const isMc = question.type === 'multiple_choice';
  const answer = isMc
    ? (question.options.find((option) => option.isCorrect)?.text.trim() ?? '')
    : question.correctText.trim();
  const notes = question.notes.trim();
  const mediaUrl = question.mediaUrl.trim();
  const answerMediaUrl = question.answerMediaUrl.trim();

  return {
    type: question.type,
    prompt: question.prompt.trim(),
    answer,
    points: question.points,
    ...(notes ? { notes } : {}),
    ...(isMc
      ? {
          options: question.options
            .map((option) => option.text.trim())
            .filter((text) => text !== ''),
        }
      : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(answerMediaUrl ? { answerMediaUrl } : {}),
  };
}

export function toSaveRequest(
  title: string,
  rounds: EditorRound[],
): QuizDraftSaveRequest {
  return {
    title: title.trim(),
    rounds: rounds.map((round) => ({
      title: round.title.trim(),
      breakAfter: round.breakAfter,
      questions: round.questions.map(questionToPreview),
    })),
  };
}
