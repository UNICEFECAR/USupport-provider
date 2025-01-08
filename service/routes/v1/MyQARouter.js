import express from "express";

import { populateProvider } from "#middlewares/populateMiddleware";

import {
  createAnswer,
  getAllQuestions,
  archiveQuestion,
  getAllTags,
} from "#controllers/myQA";

import {
  getAllQuestionsSchema,
  createAnswerSchema,
  archiveQuestionSchema,
  countrySchema,
} from "#schemas/myQASchemas";

const router = express.Router();

router.get("/questions", populateProvider, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/my-qa/questions
   * #desc    Get  questions
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_detail_id = req.provider.provider_detail_id;

  const { type } = req.query;

  return await getAllQuestionsSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, type, provider_detail_id })
    .then(getAllQuestions)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.post("/create-answer", populateProvider, async (req, res, next) => {
  /**
   * #route   POST /provider/v1/my-qa/create-answer
   * #desc    Create a answer
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");
  const { provider_detail_id, name, surname } = req.provider;

  const payload = req.body;

  return await createAnswerSchema
    .noUnknown(true)
    .strict(true)
    .validate({
      ...payload,
      country,
      language,
      provider_detail_id,
      name,
      surname,
    })
    .then(createAnswer)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.post("/archive-question", populateProvider, async (req, res, next) => {
  /**
   * #route   POST /provider/v1/my-qa/archive-question
   * #desc    Archive a question
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_detail_id = req.provider.provider_detail_id;

  const payload = req.body;

  return await archiveQuestionSchema
    .noUnknown(true)
    .strict(true)
    .validate({
      ...payload,
      country,
      language,
      provider_detail_id,
    })
    .then(archiveQuestion)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/tags", async (req, res, next) => {
  /**
   * #route   GET /provider/v1/my-qa/tags
   * #desc    Get all existing tags
   */
  const country = req.header("x-country-alpha-2");

  return await countrySchema
    .noUnknown(true)
    .strict(true)
    .validate({
      country,
    })
    .then(getAllTags)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
