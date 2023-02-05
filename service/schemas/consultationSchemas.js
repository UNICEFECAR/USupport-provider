import * as yup from "yup";

const USER_TYPES = ["client", "provider"];

export const getConsultationsByProviderIDSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  providerId: yup.string().uuid().required(),
});

export const addConsultationAsPendingSchema =
  getConsultationsByProviderIDSchema.shape({
    clientId: yup.string().uuid().required(),
    time: yup.string().required(),
  });

export const getConsultationByIDSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
});

export const rescheduleConsultationSchema = getConsultationByIDSchema.shape({
  newConsultationId: yup.string().uuid().required(),
});

export const cancelConsultationSchema = getConsultationByIDSchema.shape({
  canceledBy: yup.string().oneOf(USER_TYPES).required(),
});

export const joinConsultationSchema = getConsultationByIDSchema.shape({
  userType: yup.string().oneOf(USER_TYPES).required(),
});

export const leaveConsultationSchema = getConsultationByIDSchema.shape({
  userId: yup.string().uuid().required(),
  userType: yup.string().oneOf(USER_TYPES).required(),
});

export const getAllPastConsultationsByClientIdSchema =
  getConsultationsByProviderIDSchema.shape({
    clientId: yup.string().uuid().required(),
  });

export const getAllUpcomingConsultationsSchema =
  getConsultationsByProviderIDSchema.shape({
    pageNo: yup.number().positive().required(),
  });

export const getAllConsultationsCountSchema = yup.object().shape({
  country: yup.string().required(),
  providerId: yup.string().uuid().required(),
});

export const getAllConsultationsSingleWeekSchema =
  getConsultationsByProviderIDSchema.shape({
    startDate: yup.string().required(),
  });

export const getAllConsultationsSingleDaySchema =
  getConsultationsByProviderIDSchema.shape({
    date: yup.string().required(),
  });

export const getConsultationTimeSchema = getConsultationByIDSchema.shape({
  userId: yup.string().uuid().required(),
});
