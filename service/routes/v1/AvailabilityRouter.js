import express from "express";

import { populateUser } from "#middlewares/populateMiddleware";

import {
  getAvailabilitySingleWeekSchema,
  updateAvailabilitySingleWeekSchema,
  deleteAvailabilitySingleWeekSchema,
  updateAvailabilityByTemplateSchema,
  getAvailabilitySingleDaySchema,
  clearAvailabilitySlotSchema,
} from "#schemas/availabilitySchemas";

import {
  getAvailabilitySingleWeek,
  updateAvailabilitySingleWeek,
  deleteAvailabilitySingleWeek,
  updateAvailabilityByTemplate,
  getAvailabilitySingleDay,
  clearAvailabilitySlot,
} from "#controllers/availability";

const router = express.Router();

router
  .route("/single-week")
  .get(populateUser, async (req, res, next) => {
    /**
     * #route   GET /provider/v1/availability/single-week
     * #desc    Get current provider availability for a single week
     */
    const country = req.header("x-country-alpha-2");

    const provider_id = req.user.provider_detail_id;

    const startDate = req.query.startDate;

    return await getAvailabilitySingleWeekSchema
      .noUnknown(true)
      .strict(true)
      .validate({ country, provider_id, startDate })
      .then(getAvailabilitySingleWeek)
      .then((result) => res.status(200).send(result))
      .catch(next);
  })
  .put(populateUser, async (req, res, next) => {
    /**
     * #route   PUT /provider/v1/availability/single-week
     * #desc    Add a slot to the provider availability for a single week
     */
    const country = req.header("x-country-alpha-2");
    const language = req.header("x-language-alpha-2");

    const provider_id = req.user.provider_detail_id;

    const payload = req.body;

    return await updateAvailabilitySingleWeekSchema
      .noUnknown(true)
      .strict()
      .validate({ country, language, provider_id, ...payload })
      .then(updateAvailabilitySingleWeek)
      .then((result) => res.status(200).send(result))
      .catch(next);
  })
  .delete(populateUser, async (req, res, next) => {
    /**
     * #route   DELETE /provider/v1/availability/single-week
     * #desc    Delete a slot from the provider availability for a single week
     */
    const country = req.header("x-country-alpha-2");

    const provider_id = req.user.provider_detail_id;

    const payload = req.body;

    return await deleteAvailabilitySingleWeekSchema
      .noUnknown(true)
      .strict()
      .validate({ country, provider_id, ...payload })
      .then(deleteAvailabilitySingleWeek)
      .then((result) => res.status(200).send(result))
      .catch(next);
  });

router.route("/clear-slot").delete(populateUser, async (req, res, next) => {
  /**
   * #route   DELETE /provider/v1/availability/clear-slot
   * #desc    Delete all occurances of a timestamp from the providers availability
   */
  const country = req.header("x-country-alpha-2");

  const provider_id = req.user.provider_detail_id;

  const payload = req.body;

  return await clearAvailabilitySlotSchema
    .noUnknown(true)
    .strict()
    .validate({ ...payload, country, provider_id })
    .then(clearAvailabilitySlot)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/template").put(populateUser, async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/availability/template
   * #desc    Add multiple slots to the provider availability for multiple weeks
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.user.provider_detail_id;

  const payload = req.body;

  return await updateAvailabilityByTemplateSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, ...payload })
    .then(updateAvailabilityByTemplate)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/single-day").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/availability/single-day
   * #desc    Get current provider availability for a single day,
   *          excluding any slots that are in the past or are already booked.
   */
  const country = req.header("x-country-alpha-2");

  let providerId = "";
  if (req.user.provider_detail_id) {
    providerId = req.user.provider_detail_id;
  } else {
    providerId = req.query.providerId;
  }

  const startDate = req.query.startDate;
  const day = req.query.day;
  const campaignId = req.query.campaignId;

  return await getAvailabilitySingleDaySchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, providerId, startDate, day, campaignId })
    .then(getAvailabilitySingleDay)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
