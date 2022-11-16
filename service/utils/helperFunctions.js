import { getAvailabilitySingleWeekQuery } from "#queries/availability";

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
