import * as yup from "yup";

export const getAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
});

export const updateAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
  slot: yup.string().required(),
});

export const deleteAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
  slot: yup.string().required(),
});
