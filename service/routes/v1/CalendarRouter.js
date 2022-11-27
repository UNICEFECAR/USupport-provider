import express from "express";

import { populateUser } from "#middlewares/populateMiddleware";

import { getCalendarFiveWeeksSchema } from "#schemas/calendarSchemas";

import { getCalendarFiveWeeks } from "#controllers/calendar";

const router = express.Router();

router.route("/five-weeks").get(populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/calendar/five-weeks
   * #desc    Get current provider consultations and availability for five weeks'
   */
  const country = req.header("x-country-alpha-2");

  const providerId = req.user.provider_detail_id;

  const startDate = req.query.startDate;

  return await getCalendarFiveWeeksSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, providerId, startDate })
    .then(getCalendarFiveWeeks)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
