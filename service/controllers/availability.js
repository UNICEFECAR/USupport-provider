import {
  addAvailabilityRowQuery,
  updateAvailabilitySingleSlotQuery,
  updateAvailabilityMultipleSlotsQuery,
  deleteAvailabilitySingleWeekQuery,
} from "#queries/availability";

import { getConsultationsForDayQuery } from "#queries/consultation";

import { slotsNotWithinWeek } from "#utils/errors";

import {
  getSlotsForSingleWeek,
  checkSlotsWithinWeek,
  getXDaysInSeconds,
  getSlotsForThreeWeeks,
} from "#utils/helperFunctions";

export const getAvailabilitySingleWeek = async ({
  country,
  provider_id,
  startDate,
}) => {
  return await getSlotsForThreeWeeks({
    country,
    provider_id,
    startDate,
  }).catch((err) => {
    throw err;
  });
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
  const tomorrowTimestamp = new Date().getTime() / 1000 + getXDaysInSeconds(1); // Clients can book consultations more than 24 hours in advance

  let slots = [];

  const threeWeeksSlots = await getSlotsForThreeWeeks({
    country,
    provider_id: providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const previousDayTimestamp = Number(day) - getXDaysInSeconds(1);
  const nextDayTimestamp = Number(day) + getXDaysInSeconds(2);

  const allConsultationsForDay = await getConsultationsForDayQuery({
    poolCountry: country,
    providerId,
    previousDayTimestamp,
    nextDayTimestamp,
  })
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      throw err;
    });

  // Get slots for the day before the given day, the day, and the day after the given day
  // Exclude slots that are in the past
  // Exlude slots that are less than 24 hours from now
  // Exclude slots that are pending, scheduled, or suggested
  threeWeeksSlots.forEach((slot) => {
    const slotTimestamp = new Date(slot).getTime() / 1000;

    if (
      slotTimestamp > tomorrowTimestamp &&
      slotTimestamp >= previousDayTimestamp &&
      slotTimestamp < nextDayTimestamp &&
      !allConsultationsForDay.some(
        (consultation) => new Date(consultation.time) / 1000 === slotTimestamp
      )
    ) {
      slots.push(slot);
    }
  });

  // Sort slots in ascending order
  slots.sort((a, b) => a - b);

  return slots;
};
