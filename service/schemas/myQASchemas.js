import * as yup from "yup";

export const countrySchema = yup.object().shape({
  country: yup.string().required(),
});

const baseSchema = countrySchema.shape({
  language: yup.string().required(),
});

export const createAnswerSchema = baseSchema.shape({
  question_id: yup.string().uuid().required(),
  title: yup.string().required(),
  text: yup.string().required(),
  provider_detail_id: yup.string().uuid().required(),
  tags: yup.array().required(),
  name: yup.string().required(),
  surname: yup.string().required(),
  languageId: yup.string().uuid().required(),
});

export const archiveQuestionSchema = baseSchema.shape({
  questionId: yup.string().uuid().required(),
  provider_detail_id: yup.string().uuid().required(),
  reason: yup.string().oneOf(["spam", "duplicate", "other"]).required(),
  additionalText: yup.string().nullable().notRequired(),
});

export const getAllQuestionsSchema = baseSchema.shape({
  type: yup
    .string()
    .oneOf(["answered", "self_answered", "unanswered"])
    .required(),
  provider_detail_id: yup.string().uuid().required(),
});
