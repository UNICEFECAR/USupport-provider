import {
  addAvailabilityRowQuery,
  updateAvailabilitySingleSlotQuery,
  updateAvailabilityMultipleSlotsQuery,
  deleteAvailabilitySingleWeekQuery,
  deleteAvailabilitySingleWeekAllCampaignsQuery,
  deleteAvailabilitySingleWeekAllOrganizationsQuery,
  updateSlotDurationQuery,
  clearAvailabilitySlotsBulkQuery,
} from "#queries/availability";

import {
  getConsultationsForDayQuery,
  getOverlappingConsultationByProviderIdQuery,
} from "#queries/consultation";

import { getCountryDetailsByAlpha2Query } from "#queries/users";

import { getCampaignDataByIdQuery } from "#queries/sponsors";

import {
  campaignNotFound,
  slotsNotWithinWeek,
  slotAlreadyExists,
  expiredCampaign,
  campaignOrOrganizationRequired,
  countryNotFound,
  slotOverlapsExistingSlot,
  invalidSlotDuration,
  slotDurationConflictsWithConsultation,
  slotDurationNotEnabledForCountry,
  slotNotAvailable,
} from "#utils/errors";

import {
  getSlotsForSingleWeek,
  checkSlotsWithinWeek,
  getXDaysInSeconds,
  getSlotsForThreeWeeks,
  getSlotsForCalendarPeriod,
  getMinBookableTimestamp,
} from "#utils/helperFunctions";

import {
  DEFAULT_SLOT_MINUTES,
  doSlotsOverlap,
  getSlotDuration,
  getSlotTimestamp,
  isAllowedSlotDuration,
  indexSlotsByStart,
  getBookableDurations,
} from "#utils/slotDuration";

/**
 * Every slot the provider has open in the given three-week window, as
 * `{ time, duration }` in unix seconds / minutes, across all three pools.
 *
 * Overlap has to be judged against the union: a 60-minute normal slot at 16:00
 * conflicts with a 30-minute organization slot at 16:30 just as much as with
 * another normal one.
 */
/**
 * Is this country allowed to use the given slot length?
 *
 * 30-minute slots are switched on per country with `country.has_30_min_slots`.
 * The check lives server-side as well as in the UI so that turning the flag off
 * actually prevents half-hour slots being created, rather than only hiding the
 * control.
 *
 * Note this gates *creating* slots, not booking them: slots opened while the
 * flag was on stay bookable and keep their length if it is later switched off.
 *
 * Returns the effective length so callers write a real number rather than
 * whatever the request happened to contain.
 *
 * @param {string} country alpha-2 code
 * @param {string} language
 * @param {number|null|undefined} durationMinutes
 * @returns {Promise<number>}
 */
const assertDurationAllowedForCountry = async (
  country,
  language,
  durationMinutes,
) => {
  // A missing length means the caller does not care, which has always meant an
  // hour. An explicitly wrong one (45) is still an error - null is absence, 45
  // is a mistake.
  const minutes = durationMinutes ?? DEFAULT_SLOT_MINUTES;

  if (!isAllowedSlotDuration(minutes)) throw invalidSlotDuration(language);

  // An hour is always allowed - it is what every country had before this flag.
  if (Number(minutes) === DEFAULT_SLOT_MINUTES) return DEFAULT_SLOT_MINUTES;

  const countryDetails = await getCountryDetailsByAlpha2Query(country)
    .then((res) => {
      if (res.rowCount === 0) throw countryNotFound(language);
      return res.rows[0];
    })
    .catch((err) => {
      throw err;
    });

  if (!countryDetails.has_30_min_slots) {
    throw slotDurationNotEnabledForCountry(language);
  }

  return Number(minutes);
};

const collectOpenSlots = (slotsData) => {
  const durations = slotsData.slot_durations || {};
  const seen = new Map();

  [
    ...(slotsData.slots || []),
    ...(slotsData.campaign_slots || []),
    ...(slotsData.organization_slots || []),
  ].forEach((slot) => {
    const time = getSlotTimestamp(slot);
    if (Number.isNaN(time)) return;
    // One entry per instant: the duration is shared across pools anyway.
    if (!seen.has(time)) {
      seen.set(time, { time, duration: getSlotDuration(time, durations) });
    }
  });

  return Array.from(seen.values());
};

export const getAvailabilityForPeriod = async ({
  country,
  provider_id,
  startDate,
  period,
}) => {
  return await getSlotsForCalendarPeriod({
    country,
    provider_id,
    startDate,
    period,
  }).catch((err) => {
    throw err;
  });
};

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
  durationMinutes = DEFAULT_SLOT_MINUTES,
}) => {
  if (!checkSlotsWithinWeek(startDate, [slot]))
    throw slotsNotWithinWeek(language);

  const effectiveDuration = await assertDurationAllowedForCountry(
    country,
    language,
    durationMinutes,
  );

  // A slot may not overlap another slot this provider already has open, in any
  // pool. Checked over three weeks, not one: a 60-minute slot at Sunday 23:30
  // runs into the next week's availability row.
  const surroundingSlots = await getSlotsForThreeWeeks({
    country,
    provider_id,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const slotSeconds = Number(slot);
  const overlapping = collectOpenSlots(surroundingSlots).find(
    (existing) =>
      existing.time !== slotSeconds &&
      doSlotsOverlap(
        slotSeconds,
        effectiveDuration,
        existing.time,
        existing.duration,
      ),
  );

  if (overlapping) throw slotOverlapsExistingSlot(language);

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
        durationMinutes: effectiveDuration,
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
      (t) => Array.isArray(t.slots) && t.slots.filter(Boolean).length > 0,
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
        campaignData.campaign_start_date,
      ).getTime();
      const campaignEndDate = new Date(
        campaignData.campaign_end_date,
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

    // A template slot is either a bare timestamp (the old, hour-long shape) or
    // { time, duration_minutes }. Normalise once, here.
    const normalizedSlots = slots.map((rawSlot) => {
      const seconds = Number(getSlotTimestamp(rawSlot));
      const duration = Number(
        rawSlot?.duration_minutes ?? DEFAULT_SLOT_MINUTES,
      );
      if (!isAllowedSlotDuration(duration)) throw invalidSlotDuration(language);
      // The template already loaded the country, so gate against that rather
      // than re-querying once per slot.
      if (
        Number(duration) !== DEFAULT_SLOT_MINUTES &&
        !countryDetails.has_30_min_slots
      ) {
        throw slotDurationNotEnabledForCountry(language);
      }
      return { seconds, duration };
    });

    // The bulk write takes one length per call, so send one call per distinct
    // length - at most two, since a slot is 30 or 60 minutes.
    const slotsByDuration = normalizedSlots.reduce((acc, slot) => {
      (acc[slot.duration] = acc[slot.duration] || []).push(slot.seconds);
      return acc;
    }, {});

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
          const campaignFormattedSlots = normalizedSlots.map(
            (slot) => new Date(slot.seconds * 1000),
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
            for (const [duration, seconds] of Object.entries(slotsByDuration)) {
              await updateAvailabilityMultipleSlotsQuery({
                poolCountry: country,
                provider_id,
                startDate,
                slots: seconds.map((s) => new Date(s * 1000)),
                countryId,
                campaignId,
                durationMinutes: Number(duration),
                slotSeconds: seconds,
              }).catch((err) => {
                throw err;
              });
            }
          }
        }

        if (hasOrganizations) {
          for (const { seconds: slotSeconds, duration } of normalizedSlots) {
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
              durationMinutes: duration,
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
          for (const [duration, seconds] of Object.entries(slotsByDuration)) {
            await updateAvailabilityMultipleSlotsQuery({
              poolCountry: country,
              provider_id,
              startDate,
              slots: seconds.map((s) => new Date(s * 1000)),
              durationMinutes: Number(duration),
              slotSeconds: seconds,
            }).catch((err) => {
              throw err;
            });
          }
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
  // Same lead-time rule getEarliestAvailableSlot uses, so the two cannot disagree
  // and point clients at a day whose slot list comes back empty.
  const timeToCheck = getMinBookableTimestamp(country);

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
  const slotDurations = threeWeeksSlots.slot_durations || {};

  slotsToLoopThrough.forEach((slot) => {
    const slotTimestamp = getSlotTimestamp(slot);
    const slotDuration = getSlotDuration(slotTimestamp, slotDurations);

    if (
      slotTimestamp > timeToCheck &&
      slotTimestamp >= previousDayTimestamp &&
      slotTimestamp < nextDayTimestamp &&
      // A consultation takes the slot out if it overlaps it at all - a 60-minute
      // consultation at 16:00 also hides the 30-minute slot at 16:30.
      !allConsultationsForDay.some((consultation) =>
        doSlotsOverlap(
          slotTimestamp,
          slotDuration,
          new Date(consultation.time).getTime() / 1000,
          consultation.duration_minutes,
        ),
      )
    ) {
      slots.push({
        time: slotTimestamp * 1000,
        duration_minutes: slotDuration,
        campaign_id: slot?.campaign_id || null,
        organization_id: slot?.organization_id || null,
      });
    }
  });

  // Sort slots in ascending order
  slots.sort((a, b) => a.time - b.time);

  // Drop slots that overlap one we have already offered. The write path stops
  // overlapping slots being created, but legacy rows and slots written before
  // that guard shipped can still overlap. Earlier start wins; on an equal start
  // a campaign/organization slot wins over a plain one, because that is what the
  // client used to do in the browser (SelectConsultation) and it has to agree.
  const offered = [];
  slots.forEach((slot) => {
    const clashIndex = offered.findIndex((taken) =>
      doSlotsOverlap(
        slot.time / 1000,
        slot.duration_minutes,
        taken.time / 1000,
        taken.duration_minutes,
      ),
    );

    if (clashIndex === -1) {
      offered.push(slot);
      return;
    }

    const taken = offered[clashIndex];
    const slotIsSponsored = !!(slot.campaign_id || slot.organization_id);
    const takenIsSponsored = !!(taken.campaign_id || taken.organization_id);

    if (slot.time === taken.time && slotIsSponsored && !takenIsSponsored) {
      offered[clashIndex] = slot;
    }
  });

  // Tell the client which consultation lengths each start time can actually
  // support. Two adjacent 30-minute slots can be booked as one hour, so the
  // booking UI needs more than each slot's own length to build its options.
  const slotsByStart = indexSlotsByStart(
    offered.map((slot) => ({ ...slot, time: slot.time / 1000 })),
  );

  return offered.map((slot) => ({
    ...slot,
    available_durations: getBookableDurations(slot.time / 1000, slotsByStart),
  }));
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
        }),
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
      }),
    );
  } else if (organizationId && Array.isArray(organizationId)) {
    organizationId.forEach((id) => {
      queries.push(
        deleteAvailabilitySingleWeekQuery({
          ...args,
          organizationId: id,
        }),
      );
    });
  } else {
    queries.push(deleteAvailabilitySingleWeekAllOrganizationsQuery(args));
  }

  await Promise.all(queries);
  return { success: true };
};

/**
 * Change how long an already-open slot is.
 *
 * This has to exist as its own operation rather than "delete then re-add": with
 * the overlap guard in place, a provider holding 16:00/60 who wants
 * 16:00/30 + 16:30/30 cannot add 16:30 until 16:00 has been shortened.
 */
export const updateSlotDuration = async ({
  country,
  language,
  provider_id,
  startDate,
  slot,
  durationMinutes,
}) => {
  const effectiveDuration = await assertDurationAllowedForCountry(
    country,
    language,
    durationMinutes,
  );

  const slotSeconds = Number(slot);

  const surroundingSlots = await getSlotsForThreeWeeks({
    country,
    provider_id,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const openSlots = collectOpenSlots(surroundingSlots);
  const existing = openSlots.find((x) => x.time === slotSeconds);
  if (!existing) throw slotNotAvailable(language);

  // Growing a slot can run it into the next one.
  const overlapping = openSlots.find(
    (other) =>
      other.time !== slotSeconds &&
      doSlotsOverlap(
        slotSeconds,
        effectiveDuration,
        other.time,
        other.duration,
      ),
  );
  if (overlapping) throw slotOverlapsExistingSlot(language);

  // Shrinking a slot must not cut a consultation that is already booked in it.
  const bookedConsultation = await getOverlappingConsultationByProviderIdQuery({
    poolCountry: country,
    providerId: provider_id,
    time: slotSeconds,
    durationMinutes: existing.duration,
  })
    .then((res) => res.rows[0])
    .catch((err) => {
      throw err;
    });

  if (
    bookedConsultation &&
    (bookedConsultation.duration_minutes || DEFAULT_SLOT_MINUTES) >
      effectiveDuration
  ) {
    throw slotDurationConflictsWithConsultation(language);
  }

  await updateSlotDurationQuery({
    poolCountry: country,
    provider_id,
    startDate,
    slot,
    durationMinutes: effectiveDuration,
  }).catch((err) => {
    throw err;
  });

  return { success: true };
};

/**
 * Clear many slots at once, across all three pools.
 *
 * The scheduler template's "this day is unavailable" path used to issue one
 * request per slot. On a 30-minute grid that is 48 round trips per day per week.
 */
export const clearAvailabilityDay = async ({
  country,
  provider_id,
  startDate,
  slots,
}) => {
  const slotSeconds = slots
    .map((slot) => Number(slot))
    .filter((n) => !Number.isNaN(n));

  if (slotSeconds.length === 0) return { success: true };

  await clearAvailabilitySlotsBulkQuery({
    poolCountry: country,
    provider_id,
    startDate,
    slotSeconds,
  }).catch((err) => {
    throw err;
  });

  return { success: true };
};
