import {
  getAvailabilitySingleWeekQuery,
  addAvailabilitySingleWeekQuery,
  updateAvailabilitySingleWeekQuery,
  deleteAvailabilitySingleWeekQuery,
} from "#queries/availability";

export const getAvailabilitySingleWeek = async ({
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
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const updateAvailabilitySingleWeek = async ({
  country,
  provider_id,
  startDate,
  slot,
}) => {
  // Check if start date already exists in the database
  // If it does, update the slot
  // If it doesn't, create a new row
  await getAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
        await addAvailabilitySingleWeekQuery({
          poolCountry: country,
          provider_id,
          startDate,
        }).catch((err) => {
          throw err;
        });
      }

      return await updateAvailabilitySingleWeekQuery({
        poolCountry: country,
        provider_id,
        startDate,
        slot,
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
}) => {
  await deleteAvailabilitySingleWeekQuery({
    poolCountry: country,
    provider_id,
    startDate,
    slot,
  }).catch((err) => {
    throw err;
  });

  return { success: true };
};
