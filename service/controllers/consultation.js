import {
  addConsultationAsPendingQuery,
  addConsultationAsScheduledQuery,
  addConsultationAsSuggestedQuery,
  getConsultationByIdQuery,
  updateConsultationStatusAsScheduledQuery,
  updateConsultationStatusAsSuggestedQuery,
  updateConsultationStatusAsRejectedQuery,
  rescheduleConsultationQuery,
  cancelConsultationQuery,
  getAllConsultationsByProviderIdAndClientIdQuery,
  getAllConsultationsCountQuery,
} from "#queries/consultation";

import { getClientByIdQuery } from "#queries/clients";

import { getAllConsultationsByProviderIdQuery } from "#queries/consultation";

import {
  checkIsSlotAvailable,
  getConsultationsForThreeWeeks,
} from "#utils/helperFunctions";

import {
  slotNotAvailable,
  consultationNotFound,
  clientNotFound,
} from "#utils/errors";

export const getAllConsultationsCount = async ({ country, providerId }) => {
  return await getAllConsultationsCountQuery({
    poolCountry: country,
    providerId,
  })
    .then((res) => {
      return JSON.stringify(res.rows[0].count);
    })
    .catch((err) => {
      throw err;
    });
};

export const getAllPastConsultationsByClientId = async ({
  country,
  language,
  providerId,
  clientId,
}) => {
  const consultations = await getAllConsultationsByProviderIdAndClientIdQuery({
    poolCountry: country,
    providerId,
    clientId,
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

  let clientDetails = await getClientByIdQuery({
    poolCountry: country,
    clientId,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        throw clientNotFound(language);
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientName = clientDetails.name;
    const clientSurname = clientDetails.surname;
    const clientNickname = clientDetails.nickname;

    if (consultation.time < Date.now()) {
      response.push({
        consultation_id: consultation.consultation_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: clientDetails.image,
        time: consultation.time,
        status: consultation.status,
      });
    }
  }

  return response;
};

export const getAllConsultationsSingleWeek = async ({
  country,
  language,
  providerId,
  startDate,
}) => {
  const consultations = await getConsultationsForThreeWeeks({
    country,
    providerId,
    startDate,
  }).catch((err) => {
    throw err;
  });

  // Get all clients ids
  const clientsToFetch = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id))
  );

  let clientsDetails = {};

  // For each client to fetch, fetch it
  for (let i = 0; i < clientsToFetch.length; i++) {
    const clientId = clientsToFetch[i];

    clientsDetails[clientId] = await getClientByIdQuery({
      poolCountry: country,
      clientId,
    })
      .then((res) => {
        if (res.rowCount === 0) {
          throw clientNotFound(language);
        } else {
          return res.rows[0];
        }
      })
      .catch((err) => {
        throw err;
      });
  }

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails[clientId];
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;

    response.push({
      consultation_id: consultation.consultation_id,
      client_detail_id: clientId,
      client_name: clientName
        ? `${clientName} ${clientSurname}`
        : clientNickname,
      client_image: client.image,
      time: consultation.time,
      status: consultation.status,
    });
  }

  return response;
};

export const getAllPastConsultations = async ({
  country,
  language,
  providerId,
}) => {
  const consultations = await getAllConsultationsByProviderIdQuery({
    poolCountry: country,
    providerId,
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

  // Get all clients ids
  const clientsToFetch = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id))
  );

  let clientsDetails = {};

  // For each client to fetch, fetch it
  for (let i = 0; i < clientsToFetch.length; i++) {
    const clientId = clientsToFetch[i];

    clientsDetails[clientId] = await getClientByIdQuery({
      poolCountry: country,
      clientId,
    })
      .then((res) => {
        if (res.rowCount === 0) {
          throw clientNotFound(language);
        } else {
          return res.rows[0];
        }
      })
      .catch((err) => {
        throw err;
      });
  }

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails[clientId];
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;

    if (consultation.time < Date.now() && consultation.status !== "suggested") {
      response.push({
        consultation_id: consultation.consultation_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: client.image,
        time: consultation.time,
        status: consultation.status,
      });
    }
  }

  return response;
};

export const getAllUpcomingConsultations = async ({
  country,
  language,
  providerId,
}) => {
  const consultations = await getAllConsultationsByProviderIdQuery({
    poolCountry: country,
    providerId,
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

  // Get all clients ids
  const clientsToFetch = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id))
  );

  let clientsDetails = {};

  // For each client to fetch, fetch it
  for (let i = 0; i < clientsToFetch.length; i++) {
    const clientId = clientsToFetch[i];

    clientsDetails[clientId] = await getClientByIdQuery({
      poolCountry: country,
      clientId,
    })
      .then((res) => {
        if (res.rowCount === 0) {
          throw clientNotFound(language);
        } else {
          return res.rows[0];
        }
      })
      .catch((err) => {
        throw err;
      });
  }

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails[clientId];
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;

    if (consultation.time > Date.now()) {
      response.push({
        consultation_id: consultation.consultation_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: client.image,
        time: consultation.time,
        status: consultation.status,
      });
    }
  }

  return response;
};

export const addConsultationAsPending = async ({
  country,
  language,
  clientId,
  providerId,
  time,
}) => {
  const isSlotAvailable = await checkIsSlotAvailable(country, providerId, time);

  if (!isSlotAvailable) throw slotNotAvailable(language);

  // Add consultation as pending
  const consultation = await addConsultationAsPendingQuery({
    poolCountry: country,
    clientId,
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
  consultationId,
}) => {
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
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
      client_id: consultation.client_detail_id,
      provider_id: consultation.provider_detail_id,
      time: consultationTime,
    }).catch((err) => {
      throw err;
    });
  }

  // TODO: Send notification to client and provider to confirm consultation
  return { success: true };
};

export const suggestConsultation = async ({
  country,
  language,
  consultationId,
}) => {
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
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
  // If it is, change status to suggested
  // If it is not, check if it is still available
  // If it is, make a new consultation with status suggested
  // If it is not, throw error
  if (consultation.status === "pending") {
    // Change status to suggested
    await updateConsultationStatusAsSuggestedQuery({
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

    // Add consultation as suggested
    await addConsultationAsSuggestedQuery({
      poolCountry: country,
      client_id: consultation.client_detail_id,
      provider_id: consultation.provider_detail_id,
      time: consultationTime,
    }).catch((err) => {
      throw err;
    });
  }

  // TODO: Send notification to client and provider to confirm consultation suggestion
  return { success: true };
};

export const acceptSuggestedConsultation = async ({
  country,
  language,
  consultationId,
}) => {
  return await updateConsultationStatusAsScheduledQuery({
    poolCountry: country,
    consultationId,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        // TODO: Send notification to client and provider to confirm accepted consultation suggestion
        return { success: true };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const rejectSuggestedConsultation = async ({
  country,
  language,
  consultationId,
}) => {
  return await updateConsultationStatusAsRejectedQuery({
    poolCountry: country,
    consultationId,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        // TODO: Send notification to client and provider to confirm rejected consultation suggestion
        return { success: true };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const rescheduleConsultation = async ({
  country,
  language,
  consultationId,
  newConsultationId,
}) => {
  return await rescheduleConsultationQuery({
    poolCountry: country,
    consultationId,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      }

      // Schedule the new consultation
      await scheduleConsultation({
        country,
        language,
        consultationId: newConsultationId,
      }).catch((err) => {
        throw err;
      });

      return { success: true };
      // TODO: Send notification to client and provider to confirm consultation recchedule
    })
    .catch((err) => {
      throw err;
    });
};

export const cancelConsultation = async ({
  country,
  language,
  consultationId,
  canceledBy,
}) => {
  return await cancelConsultationQuery({
    poolCountry: country,
    consultationId,
  })
    .then((raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        if (canceledBy === "client") {
          // TODO: Send notification to client and provider for canceled consultation
        } else if (canceledBy === "provider") {
          // TODO: Send notification to client and provider for canceled consultation
        }
        return { success: true };
      }
    })
    .catch((err) => {
      throw err;
    });
};
