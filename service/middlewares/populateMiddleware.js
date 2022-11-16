import { getProviderByUserID } from "#queries/providers";

import { getUserByID } from "#queries/users";

import { providerNotFound } from "#utils/errors";

import {
  formatSpecializations,
  getProviderLanguagesAndWorkWith,
} from "#utils/helperFunctions";

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

  const { languages, workWith } = await getProviderLanguagesAndWorkWith({
    country,
    provider_detail_id: provider.provider_detail_id,
  });

  provider.specializations = formatSpecializations(provider.specializations);

  provider = {
    ...provider,
    languages: languages,
    work_with: workWith,
  };

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
