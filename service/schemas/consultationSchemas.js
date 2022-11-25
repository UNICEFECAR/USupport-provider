import * as yup from "yup";

const statusTypeSchema = yup
  .string()
  .oneOf([
    "pending",
    "timeout",
    "suggested",
    "scheduled",
    "finished",
    "rescheduled",
    "cancelled",
    "rejected",
  ]);

export const addConsultationAsPendingSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  clientId: yup.string().uuid().required(),
  providerId: yup.string().uuid().required(),
  time: yup.string().required(),
});

export const scheduleConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  client_id: yup.string().uuid().required(),
  consultationId: yup.string().uuid().required(),
});

export const cancelConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
});
