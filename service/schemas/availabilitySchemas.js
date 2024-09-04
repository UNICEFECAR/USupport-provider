import * as yup from "yup";

export const getAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
});

export const updateAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  language: yup.string().required(),
  startDate: yup.string().required(),
  slot: yup.string().required(),
  campaignId: yup.string().uuid().notRequired(),
  organizationId: yup.string().uuid().notRequired(),
});

export const updateAvailabilityByTemplateSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  language: yup.string().required(),
  template: yup.array().of(
    yup.object().shape({
      startDate: yup.string().required(),
      slots: yup.array().of(yup.string().required()).required(),
    })
  ),
  campaignId: yup.string().uuid().notRequired(),
});

export const deleteAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
  slot: yup.string().required(),
  campaignId: yup.string().uuid().notRequired(),
  organizationId: yup.string().uuid().notRequired(),
});

export const clearAvailabilitySlotSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
  slot: yup.string().required(),
  campaignIds: yup.array().of(yup.string().uuid()).required(),
  organizationId: yup.string().uuid().nullable().notRequired(),
});

export const getAvailabilitySingleDaySchema = yup.object().shape({
  country: yup.string().required(),
  providerId: yup.string().uuid().required(),
  startDate: yup.string().required(),
  day: yup.string().required(),
  campaignId: yup.string().uuid().notRequired(),
});
