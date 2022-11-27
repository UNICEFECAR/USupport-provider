import {
  getSlotsForSevenWeeks,
  getConsultationsForSevenWeeks,
} from "#utils/helperFunctions";

export const getCalendarFiveWeeks = async ({
  country,
  providerId,
  startDate,
}) => {
  const slots = await getSlotsForSevenWeeks({
    country,
    providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  const consultations = await getConsultationsForSevenWeeks({
    country,
    providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  return { slots, consultations };
};
