import * as yup from "yup";

export const getAvailabilitySingleWeekSchema = yup.object().shape({
  provider_id: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
});

export const updateAvailabilitySingleWeekSchema =
  getAvailabilitySingleWeekSchema.shape({
    language: yup.string().required(),
    slot: yup.string().required(),
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
});

export const deleteAvailabilitySingleWeekSchema =
  getAvailabilitySingleWeekSchema.shape({
    slot: yup.string().required(),
  });

export const getAvailabilitySingleDaySchema =
  getAvailabilitySingleWeekSchema.shape({
    day: yup.string().required(),
  });
