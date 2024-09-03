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
  getConsultationByTimeAndProviderIdQuery,
  getUpcomingConsultationsByProviderIdQuery,
  getConsultationsSingleWeekQuery,
  getConsultationsSingleDayQuery,
} from "#queries/consultation";

import {
  getCampaignDataForMultipleIdsQuery,
  getCampignByCouponCodeQuery,
  getCampaignDataByIdQuery,
} from "#queries/sponsors";

import { getClientEmailAndUserIdQuery } from "#queries/clients";

import {
  campaignNotFound,
  clientNotFound,
  providerNotFound,
} from "#utils/errors";

const CLIENT_LOCAL_HOST = "http://localhost:3001";
const CLIENT_URL = process.env.CLIENT_URL;

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
        provider_id
      );

      if (res.rowCount === 0) {
        return {
          slots: [],
          campaign_slots: [],
          organization_slots: [],
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
  };
};

export const checkSlotsWithinWeek = (startDate, slots) => {
  const nextStartDate = Number(startDate) + getXDaysInSeconds(7);

  const invalidSlots = slots.filter((slot) => {
    if (typeof slot === "object") {
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

export const checkIsSlotAvailable = async (country, providerId, slotTime) => {
  const isNormalSlot = typeof slotTime !== "object";
  const isWithCoupon = !isNormalSlot && slotTime.campaign_id;

  const time = isWithCoupon ? slotTime.time : slotTime;
  // Check if provider is available at the time
  const startDate = getMonday(time);

  const slotsData = await getSlotsForSingleWeek({
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

  const slot = slotsToLoopThrough.find((slot) => {
    const slotTimestamp =
      new Date(isWithCoupon ? slot.time : slot).getTime() / 1000;
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

export const getLatestAvailableSlot = async (
  country,
  providerId,
  campaignId = null
) => {
  const upcomingAvailability = await getUpcomingAvailabilityByProviderIdQuery({
    poolCountry: country,
    providerId: providerId,
  })
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      throw err;
    });

  const upcomingConsultations = await getUpcomingConsultationsByProviderIdQuery(
    {
      poolCountry: country,
      providerId: providerId,
    }
  )
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      throw err;
    });

  const allAvailability = upcomingAvailability
    .map((x) => {
      return campaignId ? x.campaign_slots : x.slots;
    })
    .filter((x) => x);
  const allSlots = allAvailability.flat().sort((a, b) => {
    if (campaignId) {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    }
    return new Date(b).getTime() - new Date(a).getTime();
  });

  let latestAvailableSlot;
  for (let l = 0; l < allSlots.length; l++) {
    const slot = campaignId ? allSlots[l].time : allSlots[l];
    if (!slot) continue;

    const now = new Date().getTime(); // Clients cant book consultations in the past

    if (
      new Date(slot).getTime() > now &&
      !upcomingConsultations.find(
        (consultation) =>
          new Date(consultation.time).getTime() === new Date(slot).getTime()
      )
    ) {
      latestAvailableSlot = slot;
      break;
    }
  }
  return latestAvailableSlot;
};

export const getEarliestAvailableSlot = async (
  country,
  providerId,
  campaignId = null
) => {
  const upcomingAvailability = await getUpcomingAvailabilityByProviderIdQuery({
    poolCountry: country,
    providerId: providerId,
  })
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      throw err;
    });

  const upcomingConsultations = await getUpcomingConsultationsByProviderIdQuery(
    {
      poolCountry: country,
      providerId: providerId,
    }
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
    const availabilityToMap = campaignId
      ? availability.campaign_slots
      : availability.slots;

    for (let k = 0; k < availabilityToMap?.length; k++) {
      let slot = campaignId
        ? new Date(availabilityToMap[k].time)
        : availabilityToMap[k];
      const now = new Date().getTime() / 1000; // Clients cant book consultations in the past

      if (
        slot > new Date(now * 1000) &&
        !upcomingConsultations.find(
          (consultation) =>
            new Date(consultation.time).getTime() === new Date(slot).getTime()
        )
      ) {
        if (campaignId) {
          if (availabilityToMap[k].campaign_id === campaignId) {
            return slot;
          }
          continue;
        }
        return slot;
      }
    }
  }
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
  campaignId,
  userId,
  country,
  language,
}) => {
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

  const couponCode = campaignData.coupon_code;

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
    }
  ).catch((err) => {
    throw err;
  });

  const result = await response.json();

  return result;
};
