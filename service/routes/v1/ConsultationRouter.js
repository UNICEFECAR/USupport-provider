import express from "express";

import { populateUser } from "#middlewares/populateMiddleware";

import {
  addConsultationAsPendingSchema,
  scheduleConsultationSchema,
  cancelConsultationSchema,
} from "#schemas/consultationSchemas";

import {
  addConsultationAsPending,
  scheduleConsultation,
  cancelConsultation,
} from "#controllers/consultation";

const router = express.Router();

router.route("/block").post(populateUser, async (req, res, next) => {
  /**
   * #route   POST /provider/v1/consultation/block
   * #desc    Block a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const client_id = req.user.client_detail_id;

  const payload = req.body;

  return await addConsultationAsPendingSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, client_id, ...payload })
    .then(addConsultationAsPending)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/schedule").put(populateUser, async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/schedule
   * #desc    Schedule a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const client_id = req.user.client_detail_id;

  const payload = req.body;

  return await scheduleConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, client_id, ...payload })
    .then(scheduleConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/cancel").put(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/consultation/cancel
   * #desc    Cancel a consultation
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await cancelConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, ...payload })
    .then(cancelConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };