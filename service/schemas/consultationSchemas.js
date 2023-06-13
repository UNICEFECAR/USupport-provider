import * as yup from "yup";

const timeCampaignSchema = yup.object().shape({
  time: yup.string().required(),
  campaign_id: yup.string().uuid().required(),
});

const timeSchema = yup.string().required();

export const addConsultationAsPendingSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  clientId: yup.string().uuid().required(),
  providerId: yup.string().uuid().required(),
  rescheduleCampaignSlot: yup.boolean().notRequired(),
  time: yup.lazy((value) => {
    if (typeof value === "object") {
      return timeCampaignSchema;
    }
    return timeSchema;
  }),
  userId: yup.string().uuid().notRequired(),
  requestedBy: yup.string().oneOf(["client", "provider"]).required(),
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
  providerDetailId: yup.string().uuid().required(),
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
  userId: yup.string().uuid().required(),
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
  pageNo: yup.number().positive().required(),
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

export const getConsultationTimeSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
  userId: yup.string().uuid().required(),
});
