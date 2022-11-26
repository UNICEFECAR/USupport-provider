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
  consultationId: yup.string().uuid().required(),
});

export const rescheduleConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
  newConsultationId: yup.string().uuid().required(),
});

export const cancelConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
});

export const getAllPastConsultationsByClientIdSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
  clientId: yup.string().uuid().required(),
});

export const getAllPastConsultationsSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
});

export const getAllUpcomingConsultationsSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
});
