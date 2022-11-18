import { getAvailabilitySingleWeekQuery } from "#queries/availability";

import {
  getProviderLanguageIdsQuery,
  getProviderLanguagesQuery,
  getProviderWorkWithQuery,
} from "#queries/providers";

import { getConsultationByTimeAndProviderIdQuery } from "#queries/consultation";

export const getXDaysInSeconds = (x) => {
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;

  return x * day;
};

function getMonday(timestamp) {
  const d = new Date(timestamp * 1000);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff)).setHours(0, 0, 0, 0) / 1000;
}

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

export const getSlotsForThreeWeeks = async ({
  country,
  provider_id,
  startDate,
}) => {
  const previousWeekTimestamp = new Date(Number(startDate) * 1000);
  previousWeekTimestamp.setDate(previousWeekTimestamp.getDate() - 7);

  const previousWeek = await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate: previousWeekTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  const currentWeek = await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const nextWeekTimestamp = new Date(Number(startDate) * 1000);
  nextWeekTimestamp.setDate(nextWeekTimestamp.getDate() + 7);

  const nextWeek = await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate: nextWeekTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  return [...previousWeek, ...currentWeek, ...nextWeek];
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

export const checkIsSlotAvailable = async (country, providerId, time) => {
  // Check if provider is available at the time
  const startDate = getMonday(time);

  const slots = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const slot = slots.find((slot) => {
    const slotTimestamp = new Date(slot).getTime() / 1000;
    return slotTimestamp === Number(time);
  });
  if (!slot) return false;

  // Check if there is not already a consultation at the time
  const consultation = await getConsultationByTimeAndProviderIdQuery({
    poolCountry: country,
    providerId,
    time,
  }).catch((err) => {
    throw err;
  });

  if (consultation.rowCount > 0) return false;

  return true;
};
