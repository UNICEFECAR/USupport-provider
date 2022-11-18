import {
  addConsultationAsPendingQuery,
  addConsultationAsScheduledQuery,
  getConsultationByIdAndClientIdQuery,
  updateConsultationStatusAsScheduledQuery,
} from "#queries/consultation";

import { checkIsSlotAvailable } from "#utils/helperFunctions";

import { slotNotAvailable, consultationNotFound } from "#utils/errors";

export const addConsultationAsPending = async ({
  country,
  language,
  client_id,
  providerId,
  time,
}) => {
  const isSlotAvailable = await checkIsSlotAvailable(country, providerId, time);

  if (!isSlotAvailable) throw slotNotAvailable(language);

  // Add consultation as pending
  const consultation = await addConsultationAsPendingQuery({
    poolCountry: country,
    client_id,
    providerId,
    time,
  })
    .then((raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        return raw.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  return { consultation_id: consultation.consultation_id };
};

export const scheduleConsultation = async ({
  country,
  language,
  client_id,
  consultationId,
}) => {
  const consultation = await getConsultationByIdAndClientIdQuery({
    poolCountry: country,
    client_id,
    consultationId,
  })
    .then((raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        return raw.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  // Check if consultation status is still pending
  // If it is, change status to scheduled
  // If it is not, check if it is still available
  // If it is, make a new consultation with status scheduled
  // If it is not, throw error
  if (consultation.status === "pending") {
    // Change status to scheduled
    await updateConsultationStatusAsScheduledQuery({
      poolCountry: country,
      consultationId,
    });
  } else {
    const consultationTime = new Date(consultation.time).getTime() / 1000;

    // Check if slot is still available
    const isSlotAvailable = await checkIsSlotAvailable(
      country,
      consultation.provider_detail_id,
      consultationTime
    );
    if (!isSlotAvailable) throw slotNotAvailable(language);

    // Add consultation as scheduled
    await addConsultationAsScheduledQuery({
      poolCountry: country,
      client_id,
      provider_id: consultation.provider_detail_id,
      time: consultationTime,
    }).catch((err) => {
      throw err;
    });
  }

  return { success: true };
};
