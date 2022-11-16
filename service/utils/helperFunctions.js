import { getAvailabilitySingleWeekQuery } from "#queries/availability";

import {
  getProviderLanguageIdsQuery,
  getProviderLanguagesQuery,
  getProviderWorkWithQuery,
} from "#queries/providers";

export const formatSpecializations = (specializations) => {
  if (specializations?.length > 0) {
    return specializations.replace("{", "").replace("}", "").split(",");
  }
};

export const getProviderLanguagesAndWorkWith = async ({
  country,
  provider_detail_id,
}) => {
  const providerLanguageIds = await getProviderLanguageIdsQuery(
    country,
    provider_detail_id
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
    provider_detail_id
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  return {
    languages: providerLanguages,
    workWith: providerWorkWith,
  };
};

export const getSlotsForSingleWeek = async ({
  country,
  provider_id,
  startDate,
}) => {
  return await getAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows[0]?.slots;
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getXDaysInSeconds = (x) => {
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;

  return x * day;
};

export const checkSlotsWithinWeek = (startDate, slots) => {
  const nextStartDate = Number(startDate) + getXDaysInSeconds(7);

  const invalidSlots = slots.filter(
    (slot) =>
      Number(slot) < Number(startDate) || Number(slot) >= Number(nextStartDate)
  );

  if (invalidSlots.length > 0) {
    return false;
  }

  return true;
};
