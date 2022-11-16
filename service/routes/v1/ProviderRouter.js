import express from "express";

import {
  populateProvider,
  populateUser,
} from "#middlewares/populateMiddleware";

import {
  getAllProvidersSchema,
  getProviderByIdSchema,
  updateProviderDataSchema,
  deleteProviderDataSchema,
  updateProviderImageSchema,
  deleteProviderImageSchema,
} from "#schemas/providerSchemas";

import {
  getAllProviders,
  getProviderById,
  updateProviderData,
  deleteProviderData,
  updateProviderImage,
  deleteProviderImage,
} from "#controllers/providers";

const router = express.Router();

router.get("/", populateProvider, async (req, res) => {
  /**
   * #route   GET /provider/v1/provider
   * #desc    Get current provider data
   */
  const providerData = req.provider;

  res.status(200).send(providerData);
});

router.get("/by-id", async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/by-id
   * #desc    Get providers data by id
   */

  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.query.providerId;

  return await getProviderByIdSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id,
    })
    .then(getProviderById)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/all", async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/all
   * #desc    Get all providers' data
   */

  const country = req.header("x-country-alpha-2");

  return await getAllProvidersSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
    })
    .then(getAllProviders)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.put("/", populateProvider, async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/provider
   * #desc    Update current provider data
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.provider.provider_detail_id;
  const currentEmail = req.provider.email;
  const currentLanguageIds = req.provider.languages?.map(
    (language) => language.language_id
  );
  const currentWorkWithIds = req.provider.work_with?.map(
    (workWith) => workWith.work_with_id
  );

  const payload = req.body;

  return await updateProviderDataSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id,
      currentEmail,
      currentLanguageIds,
      currentWorkWithIds,
      ...payload,
    })
    .then(updateProviderData)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.delete("/", populateProvider, populateUser, async (req, res, next) => {
  /**
   * #route   DELETE /provider/v1/provider
   * #desc    Delete current provider data
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.provider.provider_detail_id;
  const image = req.provider.image;

  const user_id = req.user.user_id;
  const userPassword = req.user.password;

  const payload = req.body;

  return await deleteProviderDataSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id,
      user_id,
      image,
      userPassword,
      ...payload,
    })
    .then(deleteProviderData)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.put("/image", populateProvider, populateUser, async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/provider/image
   * #desc    Update the provider image
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.provider.provider_detail_id;
  const image = req.user.user_id;

  return await updateProviderImageSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, image })
    .then(updateProviderImage)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.delete("/image", populateProvider, async (req, res, next) => {
  /**
   * #route   DELETE /provider/v1/provider/image
   * #desc    Delete the provider image
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.provider.provider_detail_id;

  return await deleteProviderImageSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id })
    .then(deleteProviderImage)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
