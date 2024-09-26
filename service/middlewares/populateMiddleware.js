import { getProviderByUserID } from "#queries/providers";
import { getAllConsultationsCountQuery } from "#queries/consultation";
import { getUserByID } from "#queries/users";

import { providerNotFound } from "#utils/errors";
import { getCacheItem, setCacheItem } from "#utils/cache";

import {
  getEarliestAvailableSlot,
  formatSpecializations,
  getProviderLanguagesAndWorkWith,
} from "#utils/helperFunctions";

export const populateProvider = async (req, res, next) => {
  const country = req.header("x-country-alpha-2");
  const user_id = req.header("x-user-id");

  const cacheKey = `provider_${country}_${user_id}`;
  const cachedProviderData = await getCacheItem(cacheKey);

  if (cachedProviderData) req.provider = cachedProviderData;
  else {
    let provider = await getProviderByUserID(country, user_id)
      .then((res) => res.rows[0])
      .catch((err) => {
        throw err;
      });

    if (!provider) {
      return next(providerNotFound(country));
    }

    const { languages, workWith } = await getProviderLanguagesAndWorkWith({
      country,
      provider_detail_id: provider.provider_detail_id,
    });

    provider.specializations = formatSpecializations(provider.specializations);

    provider.total_consultations = await getAllConsultationsCountQuery({
      poolCountry: country,
      providerId: provider.provider_detail_id,
    })
      .then((res) => {
        return res.rows[0].count;
      })
      .catch((err) => {
        throw err;
      });

    provider.earliest_available_slot = await getEarliestAvailableSlot(
      country,
      provider.provider_detail_id
    );

    provider = {
      ...provider,
      languages: languages,
      work_with: workWith,
    };

    await setCacheItem(cacheKey, provider, 60 * 60); // cache data for 1 hour
    req.provider = provider;
  }

  req.provider.organizations =
    req.provider.organizations?.filter((x) => !!x.organization_id) || [];

  return next();
};

export const populateUser = async (req, res, next) => {
  const country = req.header("x-country-alpha-2");
  const user_id = req.header("x-user-id");

  const cacheKey = `user_${country}_${user_id}`;
  const cachedUserData = await getCacheItem(cacheKey);

  if (cachedUserData) req.user = cachedUserData;
  else {
    const user = await getUserByID(country, user_id)
      .then((res) => res.rows[0])
      .catch((err) => {
        throw err;
      });

    await setCacheItem(cacheKey, user, 60 * 60); // cache data for 1 hour
    req.user = user;
  }

  return next();
};
