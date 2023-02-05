import express from "express";

import {
  getAllServices,
  addServicesAfterConsultation,
} from "#controllers/service";

import { addServicesAfterConsultationSchema } from "#schemas/serviceSchemas";

const router = express.Router();

router.get("/", async (req, res, next) => {
  /**
   * #route   GET /provider/v1/services
   * #desc    Get all services
   */

  return await getAllServices()
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.route("/add").post(async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/services/add
   * #desc    Provider to add services after a consultation took place
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const payload = req.body;

  return await addServicesAfterConsultationSchema
    .noUnknown(true)
    .strict()
    .validate({ ...payload, country, language })
    .then(addServicesAfterConsultation)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
