import {
  addAvailabilityRowQuery,
  updateAvailabilitySingleSlotQuery,
  updateAvailabilityMultipleSlotsQuery,
  deleteAvailabilitySingleWeekQuery,
  deleteAvailabilitySingleWeekAllCampaignsQuery,
  deleteAvailabilitySingleWeekAllOrganizationsQuery,
} from "#queries/availability";

import { getConsultationsForDayQuery } from "#queries/consultation";

import { getCountryDetailsByAlpha2Query } from "#queries/users";

import { getCampaignDataByIdQuery } from "#queries/sponsors";

import {
  campaignNotFound,
  slotsNotWithinWeek,
  slotAlreadyExists,
  expiredCampaign,
  campaignOrOrganizationRequired,
  countryNotFound,
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

  let campaignStartDate;
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
    campaignStartDate = new Date(campaignData.campaign_start_date).getTime();
    campaignEndDate = new Date(campaignData.campaign_end_date).getTime();
  }

  if (campaignId) {
    if (today > campaignEndDate) {
      throw expiredCampaign(language);
    }
    const slotMs = Number(slot) * 1000;
    if (slotMs < campaignStartDate || slotMs > campaignEndDate) {
      throw expiredCampaign(language);
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
  campaignIds,
  organizationIds,
}) => {
  const countryDetails = await getCountryDetailsByAlpha2Query(country)
    .then((res) => {
      if (res.rowCount === 0) {
        throw countryNotFound(language);
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  const hasNormalSlots = !!countryDetails.has_normal_slots;
  const hasCampaigns =
    Array.isArray(campaignIds) && campaignIds.filter(Boolean).length > 0;
  const hasOrganizations =
    Array.isArray(organizationIds) &&
    organizationIds.filter(Boolean).length > 0;
  const hasAnySlotsInTemplate =
    Array.isArray(template) &&
    template.some(
      (t) => Array.isArray(t.slots) && t.slots.filter(Boolean).length > 0
    );

  if (
    !hasNormalSlots &&
    !hasCampaigns &&
    !hasOrganizations &&
    hasAnySlotsInTemplate
  ) {
    throw campaignOrOrganizationRequired(language);
  }

  let campaignRanges = null;
  if (hasCampaigns) {
    const today = new Date().getTime();
    campaignRanges = new Map();
    for (const campaignId of campaignIds) {
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
      const campaignStartDate = new Date(
        campaignData.campaign_start_date
      ).getTime();
      const campaignEndDate = new Date(
        campaignData.campaign_end_date
      ).getTime();
      campaignRanges.set(campaignId, {
        startMs: campaignStartDate,
        endMs: campaignEndDate,
      });
      if (today > campaignEndDate) {
        throw expiredCampaign(language);
      }
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

        if (hasCampaigns) {
          const campaignFormattedSlots = slots.map(
            (element) => new Date(element * 1000)
          );
          for (const campaignId of campaignIds) {
            if (campaignRanges && campaignRanges.has(campaignId)) {
              const { startMs, endMs } = campaignRanges.get(campaignId);
              const hasOutOfRange = campaignFormattedSlots.some((d) => {
                const ms = d.getTime();
                return ms < startMs || ms > endMs;
              });
              if (hasOutOfRange) {
                throw expiredCampaign(language);
              }
            }
            await updateAvailabilityMultipleSlotsQuery({
              poolCountry: country,
              provider_id,
              startDate,
              slots: campaignFormattedSlots,
              countryId,
              campaignId,
            }).catch((err) => {
              throw err;
            });
          }
        }

        if (hasOrganizations) {
          for (const rawSlot of slots) {
            const slotSeconds = Number(rawSlot);
            // If the slot is already available for another organization, delete it
            const occupiedSlot =
              res.organization_slots &&
              res.organization_slots.find((x) => {
                const time = new Date(x.time).getTime() / 1000;
                return time === slotSeconds;
              });

            if (occupiedSlot) {
              if (!organizationIds.includes(occupiedSlot.organization_id)) {
                await deleteAvailabilitySingleWeekQuery({
                  poolCountry: country,
                  provider_id,
                  startDate,
                  slot: slotSeconds,
                  organizationId: occupiedSlot.organization_id,
                }).catch((err) => {
                  throw err;
                });
              } else {
                // If the slot is already assigned to the same organization we intend to add for,
                // skip re-adding to avoid duplicates.
                continue;
              }
            }

            // Assign the slot to the first provided organization (one slot can belong to only one organization)
            const targetOrganizationId = organizationIds[0];
            await updateAvailabilitySingleSlotQuery({
              poolCountry: country,
              provider_id,
              startDate,
              slot: slotSeconds,
              organizationId: targetOrganizationId,
            }).catch((err) => {
              throw err;
            });
          }
        }

        // If the country supports normal slots and no campaign/organization was
        // provided, fall back to adding "normal" availability slots (legacy behavior).
        const isNormalSlotsMode =
          hasNormalSlots && !hasCampaigns && !hasOrganizations;

        if (isNormalSlotsMode) {
          const normalFormattedSlots = slots.map(
            (element) => new Date(element * 1000)
          );
          await updateAvailabilityMultipleSlotsQuery({
            poolCountry: country,
            provider_id,
            startDate,
            slots: normalFormattedSlots,
          }).catch((err) => {
            throw err;
          });
        }

        return;
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

  const queries = [];

  // Always clear the "normal" slot entry (if any)
  queries.push(deleteAvailabilitySingleWeekQuery(args));

  // Clear campaign slots:
  // - If specific campaignIds are provided, clear only those
  // - If none are provided, clear the slot from ALL campaigns (used when
  //   marking a day fully unavailable without specifying campaigns)
  if (Array.isArray(campaignIds) && campaignIds.length > 0) {
    campaignIds.forEach((campaignId) => {
      queries.push(
        deleteAvailabilitySingleWeekQuery({
          ...args,
          campaignId,
        })
      );
    });
  } else {
    queries.push(deleteAvailabilitySingleWeekAllCampaignsQuery(args));
  }

  // Clear organization slots:
  // - If a string/array of ids is provided, clear only those
  // - If nothing is provided, clear the slot from ALL organizations (used when
  //   marking a day fully unavailable without specifying organizations)
  if (organizationId && typeof organizationId === "string") {
    queries.push(
      deleteAvailabilitySingleWeekQuery({
        ...args,
        organizationId,
      })
    );
  } else if (organizationId && Array.isArray(organizationId)) {
    organizationId.forEach((id) => {
      queries.push(
        deleteAvailabilitySingleWeekQuery({
          ...args,
          organizationId: id,
        })
      );
    });
  } else {
    queries.push(deleteAvailabilitySingleWeekAllOrganizationsQuery(args));
  }

  await Promise.all(queries);
  return { success: true };
};
