import fetch from "node-fetch";

import {
  getAvailabilitySingleWeekQuery,
  getUpcomingAvailabilityByProviderIdQuery,
} from "#queries/availability";

import {
  getProviderLanguageIdsQuery,
  getProviderLanguagesQuery,
  getProviderWorkWithQuery,
  getProviderEmailAndUserIdQuery,
  getCampaignIdsForProviderQuery,
} from "#queries/providers";

import {
  getOverlappingConsultationByProviderIdQuery,
  getUpcomingConsultationsByProviderIdQuery,
  getConsultationsSingleWeekQuery,
  getConsultationsSingleDayQuery,
} from "#queries/consultation";

import {
  DEFAULT_SLOT_MINUTES,
  doSlotsOverlap,
  getSlotDuration,
  getSlotTimestamp,
  indexSlotsByStart,
  getBookableDurations,
} from "#utils/slotDuration";

import {
  getCampaignDataForMultipleIdsQuery,
  getCampignByCouponCodeQuery,
} from "#queries/sponsors";

import { getClientEmailAndUserIdQuery } from "#queries/clients";

import { clientNotFound, providerNotFound } from "#utils/errors";

const CLIENT_LOCAL_HOST = "http://localhost:3001";
const CLIENT_URL = process.env.CLIENT_URL;

const USER_LOCAL_HOST = "http://localhost:3010";
const USER_URL = process.env.USER_URL;

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
    provider_detail_id,
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  const providerLanguages = await getProviderLanguagesQuery(
    providerLanguageIds.map((language) => language.language_id),
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  // Get the work with areas of the provider from the provider_detail_work_with_links table
  const providerWorkWith = await getProviderWorkWithQuery(
    country,
    provider_detail_id,
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

const getUniqueCampaignsData = (campaignsData) => {
  const uniqueCampaignsData = [];
  const campaignIds = [];
  campaignsData.forEach((campaign) => {
    if (!campaignIds.includes(campaign.campaign_id)) {
      uniqueCampaignsData.push(campaign);
      campaignIds.push(campaign.campaign_id);
    }
  });
  return uniqueCampaignsData;
};

const getProviderCampaignsData = async (country, provider_id) => {
  const campaignIds = await getCampaignIdsForProviderQuery({
    poolCountry: country,
    providerId: provider_id,
  }).then((res) => {
    if (res.rowCount === 0) {
      return [];
    } else {
      return res.rows.map((x) => x.campaign_id);
    }
  });

  let campaignsData = [];
  if (campaignIds.length !== 0) {
    campaignsData = await getCampaignDataForMultipleIdsQuery({
      poolCountry: country,
      campaignIds,
    })
      .then((res) => {
        if (res.rowCount === 0) {
          return [];
        } else {
          return res.rows;
        }
      })
      .catch((err) => {
        throw err;
      });
  }
  return campaignsData;
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
    .then(async (res) => {
      const campaignsData = await getProviderCampaignsData(
        country,
        provider_id,
      );

      if (res.rowCount === 0) {
        return {
          slots: [],
          campaign_slots: [],
          organization_slots: [],
          slot_durations: {},
          campaigns_data: campaignsData,
          is_empty: true,
        };
      } else {
        let campaign_slots = res.rows[0].campaign_slots;
        campaign_slots = Array.isArray(campaign_slots) ? campaign_slots : [];
        campaign_slots = campaign_slots.flat();

        let organization_slots = res.rows[0].organization_slots;
        organization_slots = Array.isArray(organization_slots)
          ? organization_slots
          : [];
        organization_slots = organization_slots.flat();

        const row = res.rows[0];
        return {
          slots: row?.slots || [],
          campaign_slots:
            campaign_slots?.filter((x) => x.time && x.campaign_id) || [],
          campaigns_data: campaignsData,
          organization_slots:
            organization_slots?.filter((x) => x.time && x.organization_id) ||
            [],
          // Shared across all three pools: an absent key means 60 minutes.
          slot_durations: row?.slot_durations || {},
        };
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

  const campaigns_data = [
    ...previousWeek.campaigns_data,
    ...currentWeek.campaigns_data,
    ...nextWeek.campaigns_data,
  ];

  const uniqueCampaignsData = getUniqueCampaignsData(campaigns_data);

  return {
    slots: [...previousWeek.slots, ...currentWeek.slots, ...nextWeek.slots],
    campaign_slots: [
      ...previousWeek.campaign_slots,
      ...currentWeek.campaign_slots,
      ...nextWeek.campaign_slots,
    ],
    campaigns_data: uniqueCampaignsData,
    organization_slots: [
      ...previousWeek.organization_slots,
      ...currentWeek.organization_slots,
      ...nextWeek.organization_slots,
    ],
    slot_durations: {
      ...previousWeek.slot_durations,
      ...currentWeek.slot_durations,
      ...nextWeek.slot_durations,
    },
  };
};

export const getSlotsForSevenWeeks = async ({
  country,
  providerId,
  startDate,
}) => {
  // Get the slots for 1 week ago
  const weekOneTimestamp = new Date(Number(startDate) * 1000);
  weekOneTimestamp.setDate(weekOneTimestamp.getDate() - 7);

  const weekOne = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekOneTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the slots for the current week
  const weekTwoTimestamp = new Date(Number(startDate) * 1000);
  weekTwoTimestamp.setDate(weekTwoTimestamp.getDate());

  const weekTwo = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekTwoTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the slots for 1 week from now
  const weekThreeTimestamp = new Date(Number(startDate) * 1000);
  weekThreeTimestamp.setDate(weekThreeTimestamp.getDate() + 7);

  const weekThree = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekThreeTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the slots for 2 weeks from now
  const weekFourTimestamp = new Date(Number(startDate) * 1000);
  weekFourTimestamp.setDate(weekFourTimestamp.getDate() + 14);

  const weekFour = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekFourTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the slots for 3 weeks from now
  const weekFiveTimestamp = new Date(Number(startDate) * 1000);
  weekFiveTimestamp.setDate(weekFiveTimestamp.getDate() + 21);

  const weekFive = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekFiveTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the slots for 4 weeks from now
  const weekSixTimestamp = new Date(Number(startDate) * 1000);
  weekSixTimestamp.setDate(weekSixTimestamp.getDate() + 28);

  const weekSix = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekSixTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the slots for 5 weeks from now
  const weekSevenTimestamp = new Date(Number(startDate) * 1000);
  weekSevenTimestamp.setDate(weekSevenTimestamp.getDate() + 35);

  const weekSeven = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate: weekSevenTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  const campaigns_data = [
    ...weekOne.campaigns_data,
    ...weekTwo.campaigns_data,
    ...weekThree.campaigns_data,
    ...weekFour.campaigns_data,
    ...weekFive.campaigns_data,
    ...weekSix.campaigns_data,
    ...weekSeven.campaigns_data,
  ];

  const uniqueCampaignsData = getUniqueCampaignsData(campaigns_data);

  return {
    slots: [
      ...weekOne.slots,
      ...weekTwo.slots,
      ...weekThree.slots,
      ...weekFour.slots,
      ...weekFive.slots,
      ...weekSix.slots,
      ...weekSeven.slots,
    ],
    campaign_slots: [
      ...weekOne.campaign_slots,
      ...weekTwo.campaign_slots,
      ...weekThree.campaign_slots,
      ...weekFour.campaign_slots,
      ...weekFive.campaign_slots,
      ...weekSix.campaign_slots,
      ...weekSeven.campaign_slots,
    ],
    campaigns_data: uniqueCampaignsData,
    organization_slots: [
      ...weekOne.organization_slots,
      ...weekTwo.organization_slots,
      ...weekThree.organization_slots,
      ...weekFour.organization_slots,
      ...weekFive.organization_slots,
      ...weekSix.organization_slots,
      ...weekSeven.organization_slots,
    ],
    slot_durations: {
      ...weekOne.slot_durations,
      ...weekTwo.slot_durations,
      ...weekThree.slot_durations,
      ...weekFour.slot_durations,
      ...weekFive.slot_durations,
      ...weekSix.slot_durations,
      ...weekSeven.slot_durations,
    },
  };
};

/** Monday 00:00 UTC for the week containing startDate (unix seconds). */
export const getUtcWeekStartUnix = (startDate) => {
  const d = new Date(Number(startDate) * 1000);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate() + mondayOffset,
      0,
      0,
      0,
      0,
    ),
  );
  return Math.floor(monday.getTime() / 1000);
};

/** Week start timestamps (unix seconds) for each week that intersects the UTC calendar month. */
export const getWeekStartsIntersectingUtcMonth = (startDate) => {
  const anchor = new Date(Number(startDate) * 1000);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const starts = new Set();

  for (let d = 1; d <= lastDay; d += 1) {
    starts.add(getUtcWeekStartUnix(Math.floor(Date.UTC(y, m, d) / 1000)));
  }

  return Array.from(starts).sort((a, b) => a - b);
};

export const mergeAvailabilityWeekResults = (weekResults) => {
  const campaigns_data = weekResults.flatMap((w) => w.campaigns_data || []);
  const uniqueCampaignsData = getUniqueCampaignsData(campaigns_data);

  return {
    slots: weekResults.flatMap((w) => w.slots || []),
    campaign_slots: weekResults.flatMap((w) => w.campaign_slots || []),
    campaigns_data: uniqueCampaignsData,
    organization_slots: weekResults.flatMap((w) => w.organization_slots || []),
    // Keys are absolute instants, so weeks never collide and a plain merge is safe.
    slot_durations: Object.assign(
      {},
      ...weekResults.map((w) => w.slot_durations || {}),
    ),
  };
};

export const getSlotsForCalendarPeriod = async ({
  country,
  provider_id,
  startDate,
  period,
}) => {
  const start = Number(startDate);

  if (period === "week" || period === "day") {
    const weekStart = getUtcWeekStartUnix(start);
    return getSlotsForThreeWeeks({
      country,
      provider_id,
      startDate: weekStart,
    });
  }

  if (period === "month") {
    const weekStarts = getWeekStartsIntersectingUtcMonth(start);
    const weeks = await Promise.all(
      weekStarts.map((weekStart) =>
        getSlotsForSingleWeek({
          country,
          provider_id,
          startDate: weekStart,
        }),
      ),
    );
    return mergeAvailabilityWeekResults(weeks);
  }

  const error = new Error(`Invalid availability period: ${period}`);
  error.status = 400;
  throw error;
};

export const checkSlotsWithinWeek = (startDate, slots) => {
  const nextStartDate = Number(startDate) + getXDaysInSeconds(7);

  const invalidSlots = slots.filter((slot) => {
    if (slot.time) {
      slot = slot.time;
    }
    return (
      Number(slot) < Number(startDate) || Number(slot) >= Number(nextStartDate)
    );
  });

  if (invalidSlots.length > 0) {
    return false;
  }

  return true;
};

/**
 * Is `slotTime` bookable with this provider?
 *
 * Returns the matching slot (annotated with the length actually booked) or
 * `false`.
 *
 * A client may ask for a length via `requestedDurationMinutes` - that is how
 * booking 01:00-02:00 works when the provider opened 01:00 and 01:30 as two
 * separate half-hour slots. The request is validated, never trusted: the length
 * has to be tiled exactly by the provider's own contiguous open slots in the
 * same pool. Ask for nothing and you get the slot's own length, which is what
 * every caller did before combining was possible.
 *
 * Which pool a slot belongs to is decided by `campaign_id` / `organization_id`,
 * not by whether the payload happens to be an object: slot payloads are objects
 * for every pool now.
 *
 * @param {string} country
 * @param {string} providerId
 * @param {number|string|{time: number|string, campaign_id?: string, organization_id?: string}} slotTime
 * @param {number} [requestedDurationMinutes]
 * @returns {Promise<false|object>}
 */
export const checkIsSlotAvailable = async (
  country,
  providerId,
  slotTime,
  requestedDurationMinutes,
) => {
  const isWithCoupon = !!slotTime?.campaign_id;
  const isOrganizationSlot = !!slotTime?.organization_id;
  const isNormalSlot = !isWithCoupon && !isOrganizationSlot;

  const time = Number(getSlotTimestamp(slotTime));
  // Check if provider is available at the time.
  // Three weeks rather than one: an hour starting at 23:30 on a Sunday is tiled
  // by a slot that lives in the next week's availability row.
  const startDate = getMonday(time);

  const slotsData = await getSlotsForThreeWeeks({
    country,
    provider_id: providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const slotsToLoopThrough = isNormalSlot
    ? slotsData.slots
    : isWithCoupon
    ? slotsData.campaign_slots
    : slotsData.organization_slots;

  const slot = slotsToLoopThrough.find(
    (slot) => getSlotTimestamp(slot) === time,
  );

  if (!slot) return false;

  // Which lengths this start time can support, given what the provider has open.
  const slotsByStart = indexSlotsByStart(
    slotsToLoopThrough.map((entry) => {
      const entryTime = getSlotTimestamp(entry);
      return {
        time: entryTime,
        duration_minutes: getSlotDuration(entryTime, slotsData.slot_durations),
        campaign_id: entry?.campaign_id || null,
        organization_id: entry?.organization_id || null,
      };
    }),
  );
  const bookableDurations = getBookableDurations(time, slotsByStart);

  const durationMinutes =
    requestedDurationMinutes == null
      ? getSlotDuration(time, slotsData.slot_durations)
      : Number(requestedDurationMinutes);

  if (!bookableDurations.includes(durationMinutes)) return false;

  // Check that no consultation of this provider overlaps the slot. Not just one
  // starting at the same instant: a 60-minute consultation at 16:00 also blocks
  // a 30-minute slot at 16:30.
  const consultation = await getOverlappingConsultationByProviderIdQuery({
    poolCountry: country,
    providerId,
    time,
    durationMinutes,
  }).catch((err) => {
    throw err;
  });

  if (consultation.rowCount > 0) return false;

  // Bare timestamps come out of the normal pool; always hand back an object so
  // callers have one shape to deal with.
  const slotObject =
    typeof slot === "object" && slot !== null ? slot : { time: slot };
  return { ...slotObject, duration_minutes: durationMinutes };
};

/**
 * Earliest instant a client may still book, in unix seconds.
 *
 * `getAvailabilitySingleDay` and `getEarliestAvailableSlot` used to compute this
 * separately and disagree, which let a provider's "earliest available slot" point
 * at a day whose slot list came back empty. One rule now, called by both.
 *
 * @param {string} country
 * @param {number} [minLeadHours] explicit lead time in hours, when the caller has one
 * @returns {number}
 */
export const getMinBookableTimestamp = (country, minLeadHours) => {
  const now = new Date().getTime() / 1000;
  if (typeof minLeadHours === "number") {
    return now + minLeadHours * 60 * 60;
  }
  // Clients cannot book less than a day ahead.
  return now + getXDaysInSeconds(1);
};

export const getLatestAvailableSlot = async (
  country,
  providerId,
  campaignId = null,
) => {
  const upcomingAvailability = await getUpcomingAvailabilityByProviderIdQuery({
    poolCountry: country,
    providerId: providerId,
  })
    .then((res) => {
      return res.rows.map((x) => ({
        ...x,
        slots: Array.isArray(x.slots) ? x.slots : [],
        organization_slots: Array.isArray(x.organization_slots)
          ? x.organization_slots
          : [],
        campaign_slots: Array.isArray(x.campaign_slots) ? x.campaign_slots : [],
        slot_durations: x.slot_durations || {},
      }));
    })
    .catch((err) => {
      throw err;
    });

  const upcomingConsultations = await getUpcomingConsultationsByProviderIdQuery(
    {
      poolCountry: country,
      providerId: providerId,
    },
  )
    .then((res) => res.rows)
    .catch((err) => {
      throw err;
    });

  const allAvailability = upcomingAvailability.map((x) => {
    const organizationSlots = Array.isArray(x.organization_slots)
      ? x.organization_slots
      : [];
    return campaignId ? x.campaign_slots : [...x.slots, ...organizationSlots];
  });

  // Flatten and clean out anything that's not an object/date
  const allSlots = allAvailability
    .flat()
    .filter((s) => s && (s.time || typeof s === "string" || s instanceof Date))
    .sort((a, b) => {
      const aTime = campaignId ? new Date(a.time) : new Date(a);
      const bTime = campaignId ? new Date(b.time) : new Date(b);
      return bTime - aTime; // descending
    });

  const slotDurations = Object.assign(
    {},
    ...upcomingAvailability.map((x) => x.slot_durations || {}),
  );

  let latestAvailableSlot;
  for (let l = 0; l < allSlots.length; l++) {
    const slotObj = allSlots[l];
    const slot = slotObj?.time ? new Date(slotObj.time) : new Date(slotObj);
    if (!slot) continue;

    const now = Date.now(); // ms since epoch
    const slotSeconds = slot.getTime() / 1000;
    const slotDuration = getSlotDuration(slotSeconds, slotDurations);

    if (
      slot.getTime() > now &&
      // A consultation blocks the slot if it overlaps it at all, not only if it
      // starts at the same instant.
      !upcomingConsultations.find((consultation) =>
        doSlotsOverlap(
          slotSeconds,
          slotDuration,
          new Date(consultation.time).getTime() / 1000,
          consultation.duration_minutes,
        ),
      )
    ) {
      latestAvailableSlot = slot;
      break;
    }
  }
  return latestAvailableSlot;
};

/**
 * Earliest bookable slot AND how long it is.
 *
 * `getEarliestAvailableSlot` below returns just the Date, which is what most
 * callers want; this is for the ones that also have to render an end time.
 *
 * @returns {Promise<{slot: Date, durationMinutes: number}|undefined>}
 */
export const getEarliestAvailableSlotWithDuration = async (
  country,
  providerId,
  campaignId = null,
  minLeadHours,
) => {
  const upcomingAvailability = await getUpcomingAvailabilityByProviderIdQuery({
    poolCountry: country,
    providerId: providerId,
  })
    .then((res) => {
      return res.rows.map((x) => ({
        ...x,
        slots: x.slots || [],
        organization_slots: x.organization_slots || [],
        campaign_slots: x.campaign_slots || [],
        slot_durations: x.slot_durations || {},
      }));
    })
    .catch((err) => {
      throw err;
    });

  const upcomingConsultations = await getUpcomingConsultationsByProviderIdQuery(
    {
      poolCountry: country,
      providerId: providerId,
    },
  )
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      throw err;
    });

  // Find the earliest upcoming availability slot that is not already in the upcoming consultations
  for (let j = 0; j < upcomingAvailability.length; j++) {
    let availability = upcomingAvailability[j];
    const organizationSlots = Array.isArray(availability.organization_slots)
      ? availability.organization_slots
      : [];

    const campaignSlots = Array.isArray(availability.campaign_slots)
      ? availability.campaign_slots
      : [];

    const slotsArray = Array.isArray(availability.slots)
      ? availability.slots
      : [];

    const availabilityToMap = (
      campaignId ? campaignSlots : [...slotsArray, ...organizationSlots]
    ).sort((a, b) => {
      const aTime = a?.time ? new Date(a.time) : new Date(a);
      const bTime = b?.time ? new Date(b.time) : new Date(b);
      return aTime - bTime;
    });

    const slotDurations = availability.slot_durations || {};

    for (let k = 0; k < availabilityToMap?.length; k++) {
      let slot = availabilityToMap[k].time
        ? new Date(availabilityToMap[k].time)
        : availabilityToMap[k];
      const timeToCheck = getMinBookableTimestamp(country, minLeadHours);
      const slotSeconds = new Date(slot).getTime() / 1000;
      const slotDuration = getSlotDuration(slotSeconds, slotDurations);
      if (
        slot > new Date(timeToCheck * 1000) &&
        !upcomingConsultations.find((consultation) =>
          doSlotsOverlap(
            slotSeconds,
            slotDuration,
            new Date(consultation.time).getTime() / 1000,
            consultation.duration_minutes,
          ),
        )
      ) {
        if (campaignId) {
          if (availabilityToMap[k].campaign_id === campaignId) {
            return { slot, durationMinutes: slotDuration };
          }
          continue;
        }
        return { slot, durationMinutes: slotDuration };
      }
    }
  }
};

/**
 * Earliest bookable slot, as a Date.
 *
 * Kept as its own export because most callers only store the instant; changing
 * the shape would ripple through every provider payload and the sorting in
 * controllers/providers.js.
 */
export const getEarliestAvailableSlot = async (
  country,
  providerId,
  campaignId = null,
  minLeadHours,
) => {
  const earliest = await getEarliestAvailableSlotWithDuration(
    country,
    providerId,
    campaignId,
    minLeadHours,
  );
  return earliest?.slot;
};

export const getConsultationsForSingleDay = async ({
  country,
  providerId,
  date,
}) => {
  return await getConsultationsSingleDayQuery({
    poolCountry: country,
    providerId,
    date,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows;
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getConsultationsForThreeDays = async ({
  country,
  providerId,
  date,
}) => {
  const previousDayTimestamp = new Date(Number(date) * 1000);
  previousDayTimestamp.setDate(previousDayTimestamp.getDate() - 1);

  const previousDay = await getConsultationsForSingleDay({
    country,
    providerId,
    date: previousDayTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  const currentDay = await getConsultationsForSingleDay({
    country,
    providerId,
    date,
  }).catch((err) => {
    throw err;
  });

  const nextDayTimestamp = new Date(Number(date) * 1000);
  nextDayTimestamp.setDate(nextDayTimestamp.getDate() + 1);

  const nextDay = await getConsultationsForSingleDay({
    country,
    providerId,
    date: nextDayTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  return [...previousDay, ...currentDay, ...nextDay];
};

export const getConsultationsForSingleWeek = async ({
  country,
  providerId,
  startDate,
}) => {
  return await getConsultationsSingleWeekQuery({
    poolCountry: country,
    providerId,
    startDate,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows;
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getConsultationsTimeForSingleWeek = async ({
  country,
  providerId,
  startDate,
}) => {
  return await getConsultationsSingleWeekQuery({
    poolCountry: country,
    providerId,
    startDate,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows.map((row) => row.time);
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getConsultationsForThreeWeeks = async ({
  country,
  providerId,
  startDate,
}) => {
  const previousWeekTimestamp = new Date(Number(startDate) * 1000);
  previousWeekTimestamp.setDate(previousWeekTimestamp.getDate() - 7);

  const previousWeek = await getConsultationsForSingleWeek({
    country,
    providerId,
    startDate: previousWeekTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  const currentWeek = await getConsultationsForSingleWeek({
    country,
    providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const nextWeekTimestamp = new Date(Number(startDate) * 1000);
  nextWeekTimestamp.setDate(nextWeekTimestamp.getDate() + 7);

  const nextWeek = await getConsultationsForSingleWeek({
    country,
    providerId,
    startDate: nextWeekTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  return [...previousWeek, ...currentWeek, ...nextWeek];
};

export const getConsultationsForSevenWeeks = async ({
  country,
  providerId,
  startDate,
}) => {
  // Get the consultations for 1 week ago
  const weekOneTimestamp = new Date(Number(startDate) * 1000);
  weekOneTimestamp.setDate(weekOneTimestamp.getDate() - 7);

  const weekOne = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekOneTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the consultations for the current week
  const weekTwoTimestamp = new Date(Number(startDate) * 1000);
  weekTwoTimestamp.setDate(weekTwoTimestamp.getDate());

  const weekTwo = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekTwoTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the consultations for 1 week from now
  const weekThreeTimestamp = new Date(Number(startDate) * 1000);
  weekThreeTimestamp.setDate(weekThreeTimestamp.getDate() + 7);

  const weekThree = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekThreeTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the consultations for 2 weeks from now
  const weekFourTimestamp = new Date(Number(startDate) * 1000);
  weekFourTimestamp.setDate(weekFourTimestamp.getDate() + 14);

  const weekFour = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekFourTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the consultations for 3 weeks from now
  const weekFiveTimestamp = new Date(Number(startDate) * 1000);
  weekFiveTimestamp.setDate(weekFiveTimestamp.getDate() + 21);

  const weekFive = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekFiveTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the consultations for 4 weeks from now
  const weekSixTimestamp = new Date(Number(startDate) * 1000);
  weekSixTimestamp.setDate(weekSixTimestamp.getDate() + 28);

  const weekSix = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekSixTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  // Get the consultations for 5 weeks from now
  const weekSevenTimestamp = new Date(Number(startDate) * 1000);
  weekSevenTimestamp.setDate(weekSevenTimestamp.getDate() + 35);

  const weekSeven = await getConsultationsTimeForSingleWeek({
    country,
    providerId,
    startDate: weekSevenTimestamp / 1000,
  }).catch((err) => {
    throw err;
  });

  return [
    ...weekOne,
    ...weekTwo,
    ...weekThree,
    ...weekFour,
    ...weekFive,
    ...weekSix,
    ...weekSeven,
  ];
};

export const getClientNotificationsData = async ({
  language,
  country,
  clientId,
}) => {
  return await getClientEmailAndUserIdQuery({
    poolCountry: country,
    clientId,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return clientNotFound(language);
      } else {
        const client = res.rows[0];
        return {
          email: client.email,
          userId: client.user_id,
          pushTokensArray: client.push_notification_tokens,
          language: client.language,
        };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getProviderNotificationsData = async ({
  language,
  country,
  providerId,
}) => {
  return await getProviderEmailAndUserIdQuery({
    poolCountry: country,
    providerId,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return providerNotFound(language);
      } else {
        const provider = res.rows[0];
        return {
          email: provider.email,
          userId: provider.user_id,
          fullName: provider.patronym
            ? `${provider.name} ${provider.patronym} ${provider.surname}`
            : `${provider.name} ${provider.surname}`,
          language: provider.language,
        };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const shuffleArray = (array) => {
  if (!array?.length) return [];
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
};

export const getCampaignDataByCouponCode = async ({ country, couponCode }) => {
  return await getCampignByCouponCodeQuery({
    poolCountry: country,
    couponCode,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return null;
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const checkCanClientUseCoupon = async ({
  couponCode,
  userId,
  country,
  language,
}) => {
  const response = await fetch(
    `${CLIENT_URL}/client/v1/client/check-coupon?couponCode=${couponCode}`,
    {
      method: "GET",
      headers: {
        host: CLIENT_LOCAL_HOST,
        "x-user-id": userId,
        "Content-type": "application/json",
        "Cache-control": "no-cache",
        "x-country-alpha-2": country,
        "x-language-alpha-2": language,
      },
    },
  ).catch((err) => {
    throw err;
  });

  const result = await response.json();

  return result;
};

const countriesMap = {
  kz: "kazakhstan",
  pl: "poland",
  ro: "romania",
  cy: "cyprus",
  am: "armenia",
  ps: "playandheal",
};

export const getCountryLabelFromAlpha2 = (alpha2) => {
  return countriesMap[alpha2.toLocaleLowerCase()];
};

export const addCountryEventRequest = async ({
  country,
  language,
  eventType,
  clientDetailId,
}) => {
  const response = await fetch(`${USER_URL}/user/v1/user/country-event`, {
    method: "POST",
    headers: {
      host: USER_LOCAL_HOST,
      "Content-type": "application/json",
      "x-client-detail-id": clientDetailId,
      "x-country-alpha-2": country,
      "x-language-alpha-2": language,
    },
    body: JSON.stringify({
      eventType,
    }),
  }).catch(console.log);

  const result = await response.json();

  return result;
};
