import * as yup from "yup";

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

export const suggestConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
});

export const acceptSuggestedConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
});

export const rejectSuggestedConsultationSchema = yup.object().shape({
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
  canceledBy: yup.string().oneOf(["client", "provider"]).required(),
});

export const joinConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
  userType: yup.string().oneOf(["client", "provider"]).required(),
});

export const leaveConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
  userType: yup.string().oneOf(["client", "provider"]).required(),
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

export const getAllConsultationsCountSchema = yup.object().shape({
  country: yup.string().required(),
  providerId: yup.string().uuid().required(),
});

export const getAllConsultationsSingleWeekSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
  startDate: yup.string().required(),
});

export const getAllConsultationsSingleDaySchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
  date: yup.string().required(),
});
