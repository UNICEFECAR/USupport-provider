import {
  addAvailabilityRowQuery,
  updateAvailabilitySingleSlotQuery,
  updateAvailabilityMultipleSlotsQuery,
  deleteAvailabilitySingleWeekQuery,
} from "#queries/availability";

import { getConsultationsForDayQuery } from "#queries/consultation";

import { getProvidersByCampaignIdQuery } from "#queries/providers";
import { getCampaignDataByIdQuery } from "#queries/sponsors";

import {
  campaignNotFound,
  slotsNotWithinWeek,
  slotAlreadyExists,
} from "#utils/errors";

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
  campaignId,
}) => {
  if (!checkSlotsWithinWeek(startDate, [slot]))
    throw slotsNotWithinWeek(language);

  // If the campaignId is provided, get the data for that campaign
  let campaignStartDate, campaignEndDate;
  const today = new Date().getTime();
  if (campaignId) {
    const campaignData = await getCampaignDataByIdQuery({
      poolCountry: country,
      campaignId,
    })
      .then((res) => {
        if (res.rowCount === 0) {
          throw campaignNotFound(language);
        } else {
          return res.rows[0];
        }
      })
      .catch((err) => {
        throw err;
      });
    campaignStartDate = new Date(campaignData.campaign_start_date).getTime();
    campaignEndDate = new Date(campaignData.campaign_end_date).getTime();
  }

  if (campaignId) {
    if (today > campaignEndDate) {
      throw slotsNotWithinWeek(language);
    }
  }

  // Check if start date already exists in the database
  // If it does, update the slot
  // If it doesn't, create a new row and add the slot
  await getSlotsForSingleWeek({
    country,
    provider_id,
    startDate,
  })
    .then(async (res) => {
      if (res.slots.length === 0 && res.campaign_slots.length === 0) {
        await addAvailabilityRowQuery({
          poolCountry: country,
          provider_id,
          startDate,
        }).catch((err) => {
          throw err;
        });
      }

      // Check if the slot already exists in the availability
      // and compare the campaignId's if it's a campaign slot
      const slotsToCheck = campaignId ? res.campaign_slots : res.slots;
      const slotExists = slotsToCheck.some((s) => {
        const slotToCheck = campaignId
          ? new Date(s.time).getTime()
          : new Date(s).getTime();
        return slotToCheck === slot * 1000 && s.campaign_id === campaignId;
      });

      if (slotExists) {
        throw slotAlreadyExists(language);
      }

      return await updateAvailabilitySingleSlotQuery({
        poolCountry: country,
        provider_id,
        startDate,
        slot,
        campaignId,
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
  campaignId,
}) => {
  await deleteAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
    slot,
    campaignId,
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
  countryId,
  campaignId,
}) => {
  // If the campaignId is provided, get the data for that campaign
  let campaignStartDate, campaignEndDate;
  const today = new Date().getTime();
  if (campaignId) {
    const campaignData = await getCampaignDataByIdQuery({
      poolCountry: country,
      campaignId,
    })
      .then((res) => {
        if (res.rowCount === 0) {
          throw campaignNotFound(language);
        } else {
          return res.rows[0];
        }
      })
      .catch((err) => {
        throw err;
      });
    campaignStartDate = new Date(campaignData.campaign_start_date).getTime();
    campaignEndDate = new Date(campaignData.campaign_end_date).getTime();
  }

  if (campaignId) {
    if (today > campaignEndDate) {
      throw slotsNotWithinWeek(language);
    }
  }

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
        if (res.is_empty) {
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
          countryId,
          campaignId,
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
  campaignId,
}) => {
  const tomorrowTimestamp = new Date().getTime() / 1000 + getXDaysInSeconds(1); // Clients can book consultations more than 24 hours in advance

  let slots = [];
  let campaignData;

  if (campaignId) {
    campaignData = await getProvidersByCampaignIdQuery({
      poolCountry: country,
      campaignId,
    }).catch((err) => {
      throw err;
    });
  }

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

  const slotsToLoopThrough = campaignId
    ? threeWeeksSlots.campaign_slots
    : threeWeeksSlots.slots;
  // Get slots for the day before the given day, the day, and the day after the given day
  // Exclude slots that are in the past
  // Exlude slots that are less than 24 hours from now
  // Exclude slots that are pending, scheduled, or suggested
  slotsToLoopThrough.forEach((slot) => {
    let slotTimestamp;
    if (campaignId) {
      slotTimestamp = new Date(slot.time).getTime() / 1000;
    } else {
      slotTimestamp = new Date(slot).getTime() / 1000;
    }

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
  if (campaignId) {
    slots.sort((a, b) => new Date(a.time) - new Date(b.time));
  } else {
    slots.sort((a, b) => a - b);
  }

  return slots;
};

export const clearAvailabilitySlot = async ({
  country,
  provider_id,
  startDate,
  slot,
  campaignIds,
}) => {
  const args = {
    poolCountry: country,
    provider_id,
    startDate,
    slot,
  };
  const queries = [deleteAvailabilitySingleWeekQuery(args)];
  campaignIds.forEach((campaignId) => {
    queries.push(
      deleteAvailabilitySingleWeekQuery({
        ...args,
        campaignId,
      })
    );
  });

  try {
    const res = await Promise.all(queries);
    return { success: true };
  } catch (err) {
    throw err;
  }
};
