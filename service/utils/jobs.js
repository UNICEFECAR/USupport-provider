import { updateStatusOfAllPendingConsultationsToTimeoutQuery } from "#queries/consultation";

import { getAllActiveCountries } from "#queries/countries";

export const clearPendingConsultationsJob = async () => {
  const MIN_TO_TIMEOUT = 5;

  // Get all the active countries from the database
  const countries = await getAllActiveCountries()
    .then((res) => res.rows)
    .catch((err) => {
      console.log("Error in getting all active countries", err);
    });

  // Update all pending consultations for each country
  for (let i = 0; i < countries?.length; i++) {
    const country = countries[i];
    const poolCountry = country.alpha2;

    await updateStatusOfAllPendingConsultationsToTimeoutQuery({
      poolCountry,
      minToTimeout: MIN_TO_TIMEOUT,
    }).catch((err) => {
      console.log("Error in updating pending consultations", err);
    });
  }
};
