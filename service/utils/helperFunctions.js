import {
  getAvailabilitySingleWeekQuery,
  getUpcomingAvailabilityByProviderIdQuery,
} from "#queries/availability";

import {
  getProviderLanguageIdsQuery,
  getProviderLanguagesQuery,
  getProviderWorkWithQuery,
} from "#queries/providers";

import {
  getConsultationByTimeAndProviderIdQuery,
  getUpcomingConsultationsByProviderIdQuery,
  getConsultationsSingleWeekQuery,
} from "#queries/consultation";

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
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows[0]?.slots;
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

  return [...previousWeek, ...currentWeek, ...nextWeek];
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

export const checkSlotsWithinWeek = (startDate, slots) => {
  const nextStartDate = Number(startDate) + getXDaysInSeconds(7);

  const invalidSlots = slots.filter(
    (slot) =>
      Number(slot) < Number(startDate) || Number(slot) >= Number(nextStartDate)
  );

  if (invalidSlots.length > 0) {
    return false;
  }

  return true;
};

export const checkIsSlotAvailable = async (country, providerId, time) => {
  // Check if provider is available at the time
  const startDate = getMonday(time);

  const slots = await getSlotsForSingleWeek({
    country,
    provider_id: providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const slot = slots.find((slot) => {
    const slotTimestamp = new Date(slot).getTime() / 1000;
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

export const getEarliestAvailableSlot = async (country, providerId) => {
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
    for (let k = 0; k < availability.slots?.length; k++) {
      let slot = availability.slots[k];
      const tomorrowTimestamp =
        new Date().getTime() / 1000 + getXDaysInSeconds(1); // Clients can book consultations more than 24 hours in advance

      if (
        slot > new Date(tomorrowTimestamp * 1000) &&
        !upcomingConsultations.find(
          (consultation) => consultation.time === slot
        )
      ) {
        return slot;
      }
    }
  }
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
