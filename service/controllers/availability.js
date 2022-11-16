import {
  getAvailabilitySingleWeekQuery,
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
  const previousWeekDate = new Date(Number(startDate));
  previousWeekDate.setDate(previousWeekDate.getDate() - 7);
  const previousWeekDateTimestamp = previousWeekDate.getTime() / 1000;

  const previousWeek = await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate: previousWeekDateTimestamp,
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

  const nextWeekDate = new Date(Number(startDate));
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekDateTimestamp = nextWeekDate.getTime() / 1000;

  const nextWeek = await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate: nextWeekDateTimestamp,
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
  // If it doesn't, create a new row
  await getAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
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
