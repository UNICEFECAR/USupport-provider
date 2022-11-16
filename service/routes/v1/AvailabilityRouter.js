import express from "express";

import { populateUser } from "#middlewares/populateMiddleware";

import {
  getAvailabilitySingleWeekSchema,
  updateAvailabilitySingleWeekSchema,
  deleteAvailabilitySingleWeekSchema,
} from "#schemas/availabilitySchemas";

import {
  getAvailabilitySingleWeek,
  updateAvailabilitySingleWeek,
  deleteAvailabilitySingleWeek,
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

    const provider_id = req.user.provider_detail_id;

    const payload = req.body;

    return await updateAvailabilitySingleWeekSchema
      .noUnknown(true)
      .strict()
      .validate({ country, provider_id, ...payload })
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

export { router };
