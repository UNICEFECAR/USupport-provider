import {
  addAvailabilitySingleWeekQuery,
  updateAvailabilitySingleWeekQuery,
  deleteAvailabilitySingleWeekQuery,
} from "#queries/availability";

import { getSlotsForSingleWeek } from "#utils/helperFunctions";

export const getAvailabilitySingleWeek = async ({
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

export const updateAvailabilitySingleWeek = async ({
  country,
  provider_id,
  startDate,
  slot,
}) => {
  // Check if start date already exists in the database
  // If it does, update the slot
  // If it doesn't, create a new row and add the slot
  await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate,
  })
    .then(async (res) => {
      if (res.length === 0) {
        await addAvailabilitySingleWeekQuery({
          poolCountry: country,
          provider_id,
          startDate,
        }).catch((err) => {
          throw err;
        });
      }

      return await updateAvailabilitySingleWeekQuery({
        poolCountry: country,
        provider_id,
        startDate,
        slot,
      }).catch((err) => {
        throw err;
      });
    })
    .catch((err) => {
      throw err;
    });

  return { success: true };
};

export const deleteAvailabilitySingleWeek = async ({
  country,
  provider_id,
  startDate,
  slot,
}) => {
  await deleteAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
    slot,
  }).catch((err) => {
    throw err;
  });

  return { success: true };
};
