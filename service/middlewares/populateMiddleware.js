import {
  getProviderByUserID,
  getProviderLanguageIdsQuery,
  getProviderLanguagesQuery,
  getProviderWorkWithQuery,
} from "#queries/providers";

import { getUserByID } from "#queries/users";

import { providerNotFound } from "#utils/errors";

export const populateProvider = async (req, res, next) => {
  const country = req.header("x-country-alpha-2");
  const user_id = req.header("x-user-id");

  let provider = await getProviderByUserID(country, user_id)
    .then((res) => res.rows[0])
    .catch((err) => {
      throw err;
    });

  if (!provider) {
    return next(providerNotFound(country));
  }

  const providerLanguageIds = await getProviderLanguageIdsQuery(
    country,
    provider.provider_detail_id
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  const providerLanguages = await getProviderLanguagesQuery(
    providerLanguageIds.map((language) => language.language_id)
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  // Get the work with areas of the provider from the provider_detail_work_with_links table
  const providerWorkWith = await getProviderWorkWithQuery(
    country,
    provider.provider_detail_id
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  provider = {
    ...provider,
    languages: providerLanguages,
    work_with: providerWorkWith,
  };

  if (provider.specializations?.length > 0) {
    provider.specializations = provider.specializations
      .replace("{", "")
      .replace("}", "")
      .split(",");
  }

  req.provider = provider;

  return next();
};

export const populateUser = async (req, res, next) => {
  const country = req.header("x-country-alpha-2");
  const user_id = req.header("x-user-id");

  const user = await getUserByID(country, user_id)
    .then((res) => res.rows[0])
    .catch((err) => {
      throw err;
    });

  req.user = user;

  return next();
};
