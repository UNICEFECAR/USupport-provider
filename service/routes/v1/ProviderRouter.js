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
  getAllClientsSchema,
} from "#schemas/providerSchemas";

import {
  getAllProviders,
  getProviderById,
  updateProviderData,
  deleteProviderData,
  updateProviderImage,
  deleteProviderImage,
  getAllClients,
} from "#controllers/providers";

import { getUserByProviderID } from "#queries/users";

import { userNotFound } from "#utils/errors";

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
   * #desc    Get providers data by id, excluding the street, city and postcode data if request is not from a country admin
   */

  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.query.providerId;

  let isRequestedByAdmin = false;

  if (req.header("x-admin-id")) {
    isRequestedByAdmin = true;
  }

  return await getProviderByIdSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id,
      isRequestedByAdmin,
    })
    .then(getProviderById)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/all", async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/all
   * #desc    Get all providers' data, excluding the street, city and postcode data.
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

router.put("/by-id/admin", async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/provider/by-id/admin
   * #desc    Country admin to update provider data by id
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const { providerId } = req.body;

  const provider = await getProviderById({
    country,
    language,
    provider_id: providerId,
    isRequestedByAdmin: true,
  }).catch(next);

  const currentEmail = provider?.email;
  const currentLanguageIds = provider?.languages?.map(
    (language) => language.language_id
  );
  const currentWorkWithIds = provider?.work_with?.map(
    (workWith) => workWith.work_with_id
  );

  const payload = req.body;

  delete payload.providerId;

  return await updateProviderDataSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id: providerId,
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

router.delete("/by-id/admin", async (req, res, next) => {
  /**
   * #route   DELETE /provider/v1/provider/by-id/admin
   * #desc    Country admin to delete provider data
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const { providerId } = req.body;

  const provider = await getProviderById({
    country,
    language,
    provider_id: providerId,
    isRequestedByAdmin: true,
  }).catch(next);

  const provider_id = provider.provider_detail_id;
  const image = provider.image;

  const user = await getUserByProviderID(country, provider_id)
    .then((res) => {
      if (res.rowCount === 0) {
        throw userNotFound(language);
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  const user_id = user.user_id;
  const isRequestedByAdmin = true;

  const payload = req.body;

  delete payload.providerId;

  return await deleteProviderDataSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id,
      user_id,
      image,
      isRequestedByAdmin,
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

router.put("/image/admin", async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/provider/image/admin
   * #desc    Country admin to update the provider image
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const { providerId: provider_id, image } = req.body;

  return await updateProviderImageSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, image })
    .then(updateProviderImage)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.delete("/image/admin", async (req, res, next) => {
  /**
   * #route   DELETE /provider/v1/provider/image/admin
   * #desc    Country admin to delete the provider image
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const { providerId: provider_id } = req.body;

  return await deleteProviderImageSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id })
    .then(deleteProviderImage)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/clients", populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/clients
   * #desc    Get all clients' data for the current provider
   */

  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  return await getAllClientsSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, providerId })
    .then(getAllClients)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
