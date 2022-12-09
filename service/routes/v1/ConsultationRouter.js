import express from "express";

import { populateUser } from "#middlewares/populateMiddleware";

import {
  addConsultationAsPendingSchema,
  scheduleConsultationSchema,
  suggestConsultationSchema,
  acceptSuggestedConsultationSchema,
  rejectSuggestedConsultationSchema,
  rescheduleConsultationSchema,
  cancelConsultationSchema,
  getAllConsultationsCountSchema,
  getAllPastConsultationsByClientIdSchema,
  getAllPastConsultationsSchema,
  getAllUpcomingConsultationsSchema,
  getAllConsultationsSingleWeekSchema,
  getAllConsultationsSingleDaySchema,
  joinConsultationSchema,
  leaveConsultationSchema,
} from "#schemas/consultationSchemas";

import {
  addConsultationAsPending,
  scheduleConsultation,
  suggestConsultation,
  acceptSuggestedConsultation,
  rejectSuggestedConsultation,
  rescheduleConsultation,
  cancelConsultation,
  getAllConsultationsCount,
  getAllPastConsultationsByClientId,
  getAllPastConsultations,
  getAllUpcomingConsultations,
  getAllConsultationsSingleWeek,
  getAllConsultationsSingleDay,
  joinConsultation,
  leaveConsultation,
} from "#controllers/consultation";

const router = express.Router();

router.route("/single-day").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/consultation/single-day
   * #desc    Get all the consultations of the current provider for a single day
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  const date = req.query.date;

  return await getAllConsultationsSingleDaySchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerId, date })
    .then(getAllConsultationsSingleDay)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/single-week").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/consultation/single-week
   * #desc    Get all the consultations of the current provider for a single week
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  const startDate = req.query.startDate;

  return await getAllConsultationsSingleWeekSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerId, startDate })
    .then(getAllConsultationsSingleWeek)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/count").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/consultation/count
   * #desc    Get the count of all past and future consultations for the current provider
   */
  const country = req.header("x-country-alpha-2");

  const providerId = req.user.provider_detail_id;

  return await getAllConsultationsCountSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, providerId })
    .then(getAllConsultationsCount)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/all/past/by-id").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/consultation/all/past/by-id
   * #desc    Get all the past consultations of the current provider for a specific client
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  const clientId = req.query.clientId;

  return await getAllPastConsultationsByClientIdSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerId, clientId })
    .then(getAllPastConsultationsByClientId)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/all/past").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/consultation/all/past
   * #desc    Get all the past consultations of the current provider for all clients
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  return await getAllPastConsultationsSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerId })
    .then(getAllPastConsultations)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/all/upcoming").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/consultation/all/upcoming
   * #desc    Get all the upcoming consultations of the current provider for all clients
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  return await getAllUpcomingConsultationsSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerId })
    .then(getAllUpcomingConsultations)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/block").post(populateUser, async (req, res, next) => {
  /**
   * #route   POST /provider/v1/consultation/block
   * #desc    Block a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  let providerId = "";
  if (req.user.provider_detail_id) {
    providerId = req.user.provider_detail_id;
  } else {
    providerId = req.body.providerId;
  }

  let clientId = req.user.client_detail_id;
  if (req.user.client_detail_id) {
    clientId = req.user.client_detail_id;
  } else {
    clientId = req.body.clientId;
  }

  const { time } = req.body;

  return await addConsultationAsPendingSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, clientId, providerId, time })
    .then(addConsultationAsPending)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/schedule").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/schedule
   * #desc    Schedule a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await scheduleConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(scheduleConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/suggest").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/suggest
   * #desc    Suggest a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await suggestConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(suggestConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/accept-suggest").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/accept-suggest
   * #desc    Accept a suggested consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await acceptSuggestedConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(acceptSuggestedConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/reject-suggest").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/reject-suggest
   * #desc    Reject a suggested consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await rejectSuggestedConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(rejectSuggestedConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/reschedule").post(async (req, res, next) => {
  /**
   * #route   POST /provider/v1/consultation/reschedule
   * #desc    Reschedule a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await rescheduleConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(rescheduleConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/join").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/join
   * #desc    Client/Provider join a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await joinConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(joinConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/leave").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/finished
   * #desc    Client/Provider leave a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const userId = req.user.user_id;

  const payload = req.body;

  return await leaveConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, userId, ...payload })
    .then(leaveConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/cancel").put(populateUser, async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/cancel
   * #desc    Cancel a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const canceledBy = req.user.type;

  const payload = req.body;

  return await cancelConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, canceledBy, ...payload })
    .then(cancelConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
