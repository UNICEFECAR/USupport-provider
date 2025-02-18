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
  getAllClientsSchema,
  getActivitiesSchema,
  getRandomProvidersSchema,
  enrollCampaignSchema,
  updateProviderStatusSchema,
  getProviderStatusSchema,
  updateProviderImageSchemaAsProvider,
  updateProviderImageSchemaAsAdmin,
  deleteProviderImageSchemaAsProvider,
  deleteProviderImageSchemaAsAdmin,
  addProviderRatingSchema,
  removeProvidersCacheSchema,
} from "#schemas/providerSchemas";

import {
  getAllProviders,
  getProviderById,
  updateProviderData,
  deleteProviderData,
  updateProviderImage,
  deleteProviderImage,
  getAllClients,
  getActivities,
  getRandomProviders,
  getCampaigns,
  enrollProviderInCampaign,
  getConsultationsForCampaign,
  updateProviderStatus,
  getProviderStatus,
  addProviderRating,
  removeProvidersCache,
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
   * #desc    Get providers data by id, excluding the street, city, postcode, phone and email data if request is not from a country admin
   */

  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const provider_id = req.query.providerId;
  const campaignId = req.query.campaignId;

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
      campaignId,
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

  const {
    campaignId,
    limit,
    offset,
    maxPrice,
    availableAfter,
    availableBefore,
    onlyFreeConsultation,
    language,
    startDate,
  } = req.query;

  const onlyAvailable = req.query === "true" ? true : false;
  const providerTypes = req.query.providerTypes?.split(",") || null;
  const sex = req.query.sex?.split(",") || null;

  return await getAllProvidersSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      campaignId,
      maxPrice: Number(maxPrice) || 0,
      availableAfter,
      availableBefore,
      onlyFreeConsultation: onlyFreeConsultation === "true" ? true : false,
      providerTypes,
      sex,
      language,
      limit: Number(limit),
      offset: Number(offset),
      onlyAvailable,
      startDate: startDate || null,
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
  const user_id = req.header("x-user-id");

  const provider_id = req.provider.provider_detail_id;
  const currentEmail = req.provider.email;
  const currentLanguageIds = req.provider.languages?.map(
    (language) => language.language_id
  );
  const currentWorkWithIds = req.provider.work_with?.map(
    (workWith) => workWith.work_with_id
  );
  const currentOrganizationIds =
    req.provider?.organizations?.map(
      (organization) => organization.organization_id
    ) || [];

  const payload = req.body;

  return await updateProviderDataSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      user_id,
      provider_id,
      currentEmail,
      currentLanguageIds,
      currentWorkWithIds,
      currentOrganizationIds,
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

  const user_id = provider?.user_id;
  const currentEmail = provider?.email;
  const currentLanguageIds = provider?.languages?.map(
    (language) => language.language_id
  );
  const currentWorkWithIds = provider?.work_with?.map(
    (workWith) => workWith.work_with_id
  );

  const currentOrganizationIds =
    provider?.organizations?.map(
      (organization) => organization.organization_id
    ) || [];

  const payload = req.body;

  delete payload.providerId;

  return await updateProviderDataSchema
    .noUnknown(true)
    .strict()
    .validate({
      country,
      language,
      provider_id: providerId,
      user_id,
      currentEmail,
      currentLanguageIds,
      currentWorkWithIds,
      currentOrganizationIds,
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
  const user_id = req.user.user_id;
  const image = user_id;

  return await updateProviderImageSchemaAsProvider
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, image, user_id })
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
  const user_id = req.header("x-user-id");

  const provider_id = req.provider.provider_detail_id;

  return await deleteProviderImageSchemaAsProvider
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, user_id })
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
  const admin_id = req.header("x-admin-id");

  const { providerId: provider_id, image } = req.body;

  return await updateProviderImageSchemaAsAdmin
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, image, admin_id })
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
  const admin_id = req.header("x-admin-id");

  const { providerId: provider_id } = req.body;

  return await deleteProviderImageSchemaAsAdmin
    .noUnknown(true)
    .strict()
    .validate({ country, language, provider_id, admin_id })
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

router.get("/activities", populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/clients
   * #desc    Get all clients' data for the current provider
   */

  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerId = req.user.provider_detail_id;

  return await getActivitiesSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, providerId })
    .then(getActivities)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/random-providers", async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/random-providers
   * #desc    Get random providers
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");
  const numberOfProviders = Number(req.query.numberOfProviders);

  return await getRandomProvidersSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, numberOfProviders })
    .then(getRandomProviders)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/campaigns", populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/campaigns
   * #desc    Get all campaigns
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");
  const providerId = req.user.provider_detail_id;

  return await getActivitiesSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, providerId })
    .then(getCampaigns)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.post("/campaigns/enroll", populateUser, async (req, res, next) => {
  /**
   * #route   POST /provider/v1/provider/campaigns/enroll
   * #desc    Enroll a provider to a campaign
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");
  const providerId = req.user.provider_detail_id;

  return await enrollCampaignSchema
    .noUnknown(true)
    .strict()
    .validate({ ...req.body, country, language, providerId })
    .then(enrollProviderInCampaign)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/campaigns/consultations", populateUser, async (req, res, next) => {
  /**
   * #route   GET /provider/v1/provider/campaigns/consultations
   * #desc    Get all consultations for a campaign
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");
  const providerId = req.user.provider_detail_id;

  const { campaignId } = req.query;

  return await enrollCampaignSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, providerId, campaignId })
    .then(getConsultationsForCampaign)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.put("/update-status", async (req, res, next) => {
  const language = req.header("x-language-alpha-2");
  const country = req.header("x-country-alpha-2");

  const { status, providerDetailId } = req.body;

  return await updateProviderStatusSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerDetailId, status })
    .then(updateProviderStatus)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.get("/status", async (req, res, next) => {
  const language = req.header("x-language-alpha-2");
  const country = req.header("x-country-alpha-2");

  const { providerId } = req.query;

  return await getProviderStatusSchema
    .noUnknown(true)
    .strict(true)
    .validate({ country, language, providerDetailId: providerId })
    .then(getProviderStatus)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.post("/add-rating", populateUser, async (req, res, next) => {
  /**
   * #route   POST /provider/v1/provider/add-rating
   * #desc    Add rating for provider
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");

  const providerDetailId = req.user.provider_detail_id;
  const payload = req.body;

  return await addProviderRatingSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, providerDetailId, ...payload })
    .then(addProviderRating)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

router.put("/remove-cache", async (req, res, next) => {
  /**
   * #route   PUT /provider/v1/provider/remove-cache
   * #desc    Remove cache for providers
   */
  const country = req.header("x-country-alpha-2");
  const language = req.header("x-language-alpha-2");
  const { providerDetailIds } = req.body;

  return await removeProvidersCacheSchema
    .noUnknown(true)
    .strict()
    .validate({ country, language, providerIds: providerDetailIds })
    .then(removeProvidersCache)
    .then((result) => res.status(200).send(result))
    .catch(next);
});

export { router };
