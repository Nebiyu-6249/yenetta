// Grading now lives in @yenetta/shared so the API and the offline mobile app
// grade identically. Re-exported here to keep existing import paths stable.
export {
  gradeAnswers,
  type GradableQuestion,
  type GradedQuestion,
  type GradedResult,
  type SubmittedAnswer,
} from '@yenetta/shared';
