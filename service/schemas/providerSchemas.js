import * as yup from "yup";

const sexTypeSchema = yup
  .string()
  .oneOf(["male", "female", "unspecified", "notMentioned"]);

const specializationsTypeSchema = yup
  .array()
  .of(
    yup
      .string()
      .oneOf(["psychologist", "psychotherapist", "psychiatrist", "coach"])
  );

export const getAllProvidersSchema = yup.object().shape({
  country: yup.string().required(),
});

export const getProviderByIdSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  provider_id: yup.string().uuid().required(),
  isRequestedByAdmin: yup.boolean().required(),
});

export const updateProviderDataSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  user_id: yup.string().uuid().required(),
  country: yup.string().required(),
  language: yup.string().required(),
  name: yup.string().required(),
  patronym: yup.string().notRequired(),
  surname: yup.string().required(),
  nickname: yup.string().notRequired(),
  email: yup.string().email().required(),
  currentEmail: yup.string().email().required(),
  phonePrefix: yup.string().notRequired(),
  phone: yup.string().notRequired(),
  specializations: specializationsTypeSchema.notRequired(),
  street: yup.string().notRequired(),
  city: yup.string().notRequired(),
  postcode: yup.string().notRequired(),
  education: yup.array().of(yup.string()).notRequired(),
  sex: sexTypeSchema.notRequired(),
  consultationPrice: yup.number().min(0).notRequired(),
  description: yup.string().notRequired(),
  workWithIds: yup.array().of(yup.string().uuid()).notRequired(),
  currentWorkWithIds: yup.array().of(yup.string().uuid()).notRequired(),
  languageIds: yup.array().of(yup.string().uuid()).notRequired(),
  currentLanguageIds: yup.array().of(yup.string().uuid()).notRequired(),
  videoLink: yup.string().notRequired(),
});

export const deleteProviderDataSchema = yup.object().shape(
  {
    provider_id: yup.string().uuid().required(),
    user_id: yup.string().uuid().required(),
    country: yup.string().required(),
    language: yup.string().required(),
    image: yup.string().required(),
    isRequestedByAdmin: yup.boolean().notRequired(),
    userPassword: yup.string().when("isRequestedByAdmin", {
      is: undefined,
      then: yup.string().required(),
    }),
    password: yup.string().when("isRequestedByAdmin", {
      is: undefined,
      then: yup.string().required(),
    }),
  },
  ["isRequestedByAdmin"]
);

export const updateProviderImageSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  user_id: yup.string().uuid().required(),
  country: yup.string().required(),
  language: yup.string().required(),
  image: yup.string().required(),
});

export const deleteProviderImageSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  user_id: yup.string().uuid().required(),
  country: yup.string().required(),
  language: yup.string().required(),
});

export const getAllClientsSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
});

export const getActivitiesSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
});
