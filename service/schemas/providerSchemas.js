import * as yup from "yup";

import {
  getProviderSpecializationsForCountry,
  PEER_SUPPORT,
} from "#utils/specializations";

const sexTypeSchema = yup
  .string()
  .oneOf(["male", "female", "unspecified", "notMentioned"]);

const resolveCountry = (getCountry, context) => {
  if (typeof getCountry === "function") {
    const resolved = getCountry(context);
    if (resolved) {
      return resolved;
    }
  } else if (typeof getCountry === "string") {
    return getCountry;
  }

  const root = context.from?.[context.from.length - 1]?.value;
  return root?.country ?? context.parent?.country;
};

const createSpecializationsTypeSchema = (getCountry) =>
  yup
    .array()
    .of(
      yup.string().test("allowed-specialization", function (value) {
        if (!value) {
          return true;
        }

        const country = resolveCountry(getCountry, this);
        const allowed = getProviderSpecializationsForCountry(country);

        if (!allowed.includes(value)) {
          return this.createError({
            message: `must be one of the following values: ${allowed.join(", ")}`,
          });
        }

        return true;
      })
    )
    .test(
      "peer-support-exclusive",
      `${PEER_SUPPORT} must be the only specialization when selected`,
      function (value) {
        if (!value?.length) {
          return true;
        }

        return !(value.includes(PEER_SUPPORT) && value.length > 1);
      }
    );

export const getAllProvidersSchema = yup.object().shape({
  country: yup.string().required(),
  campaignId: yup.string().notRequired(),
  limit: yup.number().positive().required(),
  offset: yup.number().positive().required(),
  maxPrice: yup.number().notRequired().nullable(),
  availableAfter: yup.string().notRequired().nullable(),
  availableBefore: yup.string().notRequired().nullable(),
  onlyFreeConsultation: yup.boolean().notRequired().nullable(),
  providerTypes: yup
    .array()
    .notRequired()
    .nullable()
    .test("valid-provider-types", "Invalid provider types", function (value) {
      if (!value?.length) {
        return true;
      }

      const allowed = getProviderSpecializationsForCountry(this.parent.country);
      return value.every((providerType) => allowed.includes(providerType));
    }),
  sex: yup.array().notRequired().nullable(),
  language: yup.string().notRequired().nullable(),
  onlyAvailable: yup.boolean().notRequired().nullable(),
  startDate: yup.string().notRequired().nullable(),
  billingType: yup
    .string()
    .oneOf(["paid", "coupon", "free", "all"])
    .notRequired()
    .nullable(),
  headerLanguage: yup.string().notRequired().nullable(),
  randomSeed: yup.string().notRequired().nullable(),
});

export const getProviderByIdSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  provider_id: yup.string().uuid().required(),
  isRequestedByAdmin: yup.boolean().required(),
  campaignId: yup.string().notRequired(),
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
  phone: yup.string().notRequired(),
  specializations: createSpecializationsTypeSchema(
    (context) =>
      context.from?.[context.from.length - 1]?.value?.country ??
      context.parent?.country
  ).notRequired(),
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
  organizationIds: yup.array().of(yup.string().uuid()).notRequired(),
  currentOrganizationIds: yup
    .array()
    .of(yup.string().uuid().notRequired())
    .notRequired()
    .nullable(),
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
  country: yup.string().required(),
  language: yup.string().required(),
  image: yup.string().required(),
});

export const updateProviderImageSchemaAsAdmin = updateProviderImageSchema.shape(
  {
    admin_id: yup.string().uuid().required(),
  }
);

export const updateProviderImageSchemaAsProvider =
  updateProviderImageSchema.shape({
    user_id: yup.string().uuid().required(),
  });

export const deleteProviderImageSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  language: yup.string().required(),
});

export const deleteProviderImageSchemaAsAdmin = deleteProviderImageSchema.shape(
  {
    admin_id: yup.string().uuid().required(),
  }
);

export const deleteProviderImageSchemaAsProvider =
  deleteProviderImageSchema.shape({
    user_id: yup.string().uuid().required(),
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

export const getRandomProvidersSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  numberOfProviders: yup.number().positive().required(),
});

export const enrollCampaignSchema = getActivitiesSchema.shape({
  campaignId: yup.string().uuid().required(),
});

export const updateProviderStatusSchema = yup.object().shape({
  language: yup.string().required(),
  country: yup.string().required(),
  providerDetailId: yup.string().uuid().required(),
  status: yup.string().oneOf(["active", "inactive"]).required(),
});

export const getProviderStatusSchema = yup.object().shape({
  language: yup.string().required(),
  country: yup.string().required(),
  providerDetailId: yup.string().uuid().required(),
});

export const addProviderRatingSchema = yup.object().shape({
  language: yup.string().required(),
  country: yup.string().required(),
  providerDetailId: yup.string().uuid().required(),
  rating: yup.number().min(1).max(5).required(),
  comment: yup.string().notRequired(),
});

export const removeProvidersCacheSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerIds: yup.array().of(yup.string().uuid()).required(),
});
