import {
  addAvailabilityRowQuery,
  updateAvailabilitySingleSlotQuery,
  updateAvailabilityMultipleSlotsQuery,
  deleteAvailabilitySingleWeekQuery,
} from "#queries/availability";

import { getConsultationsForDayQuery } from "#queries/consultation";

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
  organizationId,
}) => {
  if (!checkSlotsWithinWeek(startDate, [slot]))
    throw slotsNotWithinWeek(language);

  // If the campaignId is provided, get the data for that campaign
  let campaignEndDate;
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
      if (res.is_empty) {
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
      const slotsToCheck = campaignId
        ? res.campaign_slots
        : organizationId
        ? res.organization_slots
        : res.slots;

      const slotExists = slotsToCheck.some((s) => {
        const slotToCheck =
          campaignId || organizationId
            ? new Date(s.time).getTime()
            : new Date(s).getTime();
        return (
          slotToCheck === slot * 1000 &&
          ((campaignId && s.campaign_id === campaignId) ||
            (organizationId && s.organization_id === organizationId))
        );
      });

      const slotAvailableForOrg = organizationId
        ? slotsToCheck.find((x) => {
            const slotToCheck = new Date(x.time).getTime();
            return slotToCheck === slot * 1000;
          })
        : null;

      // If the slot is already available for another organization, delete it
      if (slotAvailableForOrg) {
        await deleteAvailabilitySingleWeekQuery({
          poolCountry: country,
          provider_id,
          startDate,
          slot,
          organizationId: slotAvailableForOrg.organization_id,
        }).catch((err) => {
          throw err;
        });
      }

      if (slotExists) {
        throw slotAlreadyExists(language);
      }

      return await updateAvailabilitySingleSlotQuery({
        poolCountry: country,
        provider_id,
        startDate,
        slot,
        campaignId,
        organizationId,
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
  organizationId,
}) => {
  await deleteAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
    slot,
    campaignId,
    organizationId,
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
  let campaignEndDate;
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
  const now = new Date().getTime() / 1000;
  const tomorrowTimestamp = now + getXDaysInSeconds(1);
  // const timeToCheck = country === "PL" ? tomorrowTimestamp : now;
  const timeToCheck = tomorrowTimestamp;

  let slots = [];
  // let campaignData;

  // if (campaignId) {
  //   campaignData = await getProvidersByCampaignIdQuery({
  //     poolCountry: country,
  //     campaignId,
  //   }).catch((err) => {
  //     throw err;
  //   });
  // }

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
    : [...threeWeeksSlots.slots, ...threeWeeksSlots.organization_slots];
  // Get slots for the day before the given day, the day, and the day after the given day
  // Exclude slots that are in the past
  // Exlude slots that are less than 24 hours from now
  // Exclude slots that are pending, scheduled, or suggested
  slotsToLoopThrough.forEach((slot) => {
    let slotTimestamp;
    if (slot.time) {
      slotTimestamp = new Date(slot.time).getTime() / 1000;
    } else {
      slotTimestamp = new Date(slot).getTime() / 1000;
    }
    if (
      slotTimestamp > timeToCheck &&
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
  slots.sort((a, b) => {
    // sort by time asc
    if (a.time && b.time) {
      return new Date(a.time) - new Date(b.time);
    } else if (a.time && !b.time) {
      return new Date(a.time) - new Date(b);
    } else if (!a.time && b.time) {
      return new Date(a) - new Date(b.time);
    }

    return new Date(a) - new Date(b);
  });

  return slots;
};

export const clearAvailabilitySlot = async ({
  country,
  provider_id,
  startDate,
  slot,
  campaignIds,
  organizationId,
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

  if (organizationId) {
    queries.push(
      deleteAvailabilitySingleWeekQuery({
        ...args,
        organizationId,
      })
    );
  }

  await Promise.all(queries);
  return { success: true };
};
