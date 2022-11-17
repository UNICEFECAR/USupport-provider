import {
  addAvailabilityRowQuery,
  updateAvailabilitySingleSlotQuery,
  updateAvailabilityMultipleSlotsQuery,
  deleteAvailabilitySingleWeekQuery,
} from "#queries/availability";
import { slotsNotWithinWeek } from "#utils/errors";

import {
  getSlotsForSingleWeek,
  checkSlotsWithinWeek,
  getXDaysInSeconds,
} from "#utils/helperFunctions";

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
  language,
  provider_id,
  startDate,
  slot,
}) => {
  if (!checkSlotsWithinWeek(startDate, [slot]))
    throw slotsNotWithinWeek(language);

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
        await addAvailabilityRowQuery({
          poolCountry: country,
          provider_id,
          startDate,
        }).catch((err) => {
          throw err;
        });
      }

      return await updateAvailabilitySingleSlotQuery({
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

export const updateAvailabilityByTemplate = async ({
  country,
  language,
  provider_id,
  template,
}) => {
  for (const { startDate, slots } of template) {
    if (!checkSlotsWithinWeek(startDate, slots))
      throw slotsNotWithinWeek(language);

    // Check if start date already exists in the database
    // If it does, update the slots
    // If it doesn't, create a new row and add the slots
    await getSlotsForSingleWeek({
      country,
      provider_id,
      startDate,
    })
      .then(async (res) => {
        if (res?.length === 0) {
          await addAvailabilityRowQuery({
            poolCountry: country,
            provider_id,
            startDate,
          }).catch((err) => {
            throw err;
          });
        }

        slots.forEach((element, index) => {
          slots[index] = new Date(element * 1000);
        });

        return await updateAvailabilityMultipleSlotsQuery({
          poolCountry: country,
          provider_id,
          startDate,
          slots,
        }).catch((err) => {
          throw err;
        });
      })
      .catch((err) => {
        throw err;
      });
  }

  return { success: true };
};

export const getAvailabilitySingleDay = async ({
  country,
  providerId,
  startDate,
  day,
}) => {
  const now = new Date();
  const nowTimestamp = now.getTime() / 1000;

  let slots = [];

  const singleWeekSlots = await getSlotsForSingleWeek({
    country,
    providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  // TODO: Get all consultations for the day

  // Get slots for the day
  // Exclude slots that are in the past
  // TODO: Exclude slots that are already booked
  singleWeekSlots.forEach((slot) => {
    const slotTimestamp = new Date(slot).getTime() / 1000;

    if (
      slotTimestamp > nowTimestamp &&
      slotTimestamp >= Number(day) &&
      slotTimestamp < Number(day) + getXDaysInSeconds(1)
    ) {
      slots.push(slot);
    }
  });

  return slots;
};
