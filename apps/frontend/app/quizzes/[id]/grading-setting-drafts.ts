import {
  QUESTION_KINDS,
  gradingSettingsOf,
  parseFiniteNumber,
  type GradingSettingName,
  type ImportQuestionPreview,
} from '@campus-pubquiz/types';
import type { EditorQuestion } from '@/app/quizzes/[id]/quiz-draft-state';

/** One grading setting's conversion between a stored question and the editor's draft fields. */
interface GradingSettingDraft {
  /** The draft fields this setting fills from a stored question. */
  load(question: ImportQuestionPreview): Partial<EditorQuestion>;
  save(question: EditorQuestion): Partial<ImportQuestionPreview>;
}

const matchScoringModeDraft: GradingSettingDraft = {
  load: (question) => ({
    matchScoringMode: gradingSettingsOf(question).matchScoringMode,
  }),
  save: (question) => ({ matchScoringMode: question.matchScoringMode }),
};

const marginDraft: GradingSettingDraft = {
  load: (question) => {
    const { margin } = gradingSettingsOf(question);
    return margin
      ? { marginValue: String(margin.value), marginUnit: margin.unit }
      : {};
  },
  // An unreadable value saves as NaN (null on the wire) so the server refuses it instead of quietly defaulting.
  save: (question) => ({
    margin: {
      value: parseFiniteNumber(question.marginValue) ?? Number.NaN,
      unit: question.marginUnit,
    },
  }),
};

/** One entry per grading setting; a setting without one is a compile error. */
const GRADING_SETTING_DRAFTS = {
  matchScoringMode: matchScoringModeDraft,
  margin: marginDraft,
} satisfies { readonly [Name in GradingSettingName]: GradingSettingDraft };

/** The draft fields a stored question's type-listed grading settings fill. */
export function loadGradingDrafts(
  question: ImportQuestionPreview,
): Partial<EditorQuestion> {
  return QUESTION_KINDS[question.type].gradingSettings.reduce(
    (draft, name) => ({
      ...draft,
      ...GRADING_SETTING_DRAFTS[name].load(question),
    }),
    {},
  );
}

/** The grading settings to save for a draft: only those its type's registry entry lists. */
export function saveGradingDrafts(
  question: EditorQuestion,
): Partial<ImportQuestionPreview> {
  return QUESTION_KINDS[question.type].gradingSettings.reduce(
    (saved, name) => ({
      ...saved,
      ...GRADING_SETTING_DRAFTS[name].save(question),
    }),
    {},
  );
}
