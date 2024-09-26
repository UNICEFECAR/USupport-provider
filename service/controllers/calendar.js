import {
  getSlotsForSevenWeeks,
  getConsultationsForSevenWeeks,
} from "#utils/helperFunctions";

export const getCalendarFiveWeeks = async ({
  country,
  providerId,
  startDate,
}) => {
  const slotsData = await getSlotsForSevenWeeks({
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
  console.log(slotsData);

  const organizationSlotTimes = Array.isArray(slotsData.organization_slots)
    ? slotsData.organization_slots.map((x) => x.time)
    : [];
  return {
    slots: [...slotsData.slots, ...organizationSlotTimes],
    campaign_slots: slotsData.campaign_slots,
    campaigns_data: slotsData.campaigns_data,
    consultations,
  };
};
