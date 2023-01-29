import twilio from "twilio";

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
  joinConsultationClientQuery,
  joinConsultationProviderQuery,
  leaveConsultationClientQuery,
  leaveConsultationProviderQuery,
  updateConsultationStatusAsFinishedQuery,
  getAllUpcomingConsultationsByProviderIdQuery,
  getConsultationTimeQuerry,
} from "#queries/consultation";

import { getClientByIdQuery } from "#queries/clients";

import { getProviderByIdQuery } from "#queries/providers";

import { getAllConsultationsByProviderIdQuery } from "#queries/consultation";

import { produceRaiseNotification } from "#utils/kafkaProducers";

import {
  checkIsSlotAvailable,
  getConsultationsForThreeWeeks,
  getConsultationsForThreeDays,
  getClientNotificationsData,
  getProviderNotificationsData,
} from "#utils/helperFunctions";

import {
  slotNotAvailable,
  consultationNotFound,
  clientNotFound,
  consultationNotScheduled,
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

    const oneHourBeforeNow = new Date();
    oneHourBeforeNow.setHours(oneHourBeforeNow.getHours() - 1);

    if (consultation.time < oneHourBeforeNow) {
      response.push({
        consultation_id: consultation.consultation_id,
        chat_id: consultation.chat_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: clientDetails.image,
        time: consultation.time,
        status: consultation.status,
        price: consultation.price,
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
      chat_id: consultation.chat_id,
      client_detail_id: clientId,
      client_name: clientName
        ? `${clientName} ${clientSurname}`
        : clientNickname,
      client_image: client.image,
      time: consultation.time,
      status: consultation.status,
      price: consultation.price,
    });
  }

  return response;
};

export const getAllConsultationsSingleDay = async ({
  country,
  language,
  providerId,
  date,
}) => {
  const consultations = await getConsultationsForThreeDays({
    country,
    providerId,
    date,
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
      chat_id: consultation.chat_id,
      client_detail_id: clientId,
      client_name: clientName
        ? `${clientName} ${clientSurname}`
        : clientNickname,
      client_image: client.image,
      time: consultation.time,
      status: consultation.status,
      price: consultation.price,
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

    const oneHourBeforeNow = new Date();
    oneHourBeforeNow.setHours(oneHourBeforeNow.getHours() - 1);

    if (
      consultation.time < oneHourBeforeNow &&
      consultation.status !== "suggested"
    ) {
      response.push({
        consultation_id: consultation.consultation_id,
        chat_id: consultation.chat_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: client.image,
        time: consultation.time,
        status: consultation.status,
        price: consultation.price,
      });
    }
  }

  return response;
};

export const getAllUpcomingConsultations = async ({
  country,
  language,
  providerId,
  pageNo,
}) => {
  const query = await getAllUpcomingConsultationsByProviderIdQuery({
    poolCountry: country,
    providerId,
    pageNo,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return { consultations: [], totalCount: 0 };
      } else {
        return { consultations: res.rows, totalCount: res.rows[0].total_count };
      }
    })
    .catch((err) => {
      throw err;
    });

  const { consultations, totalCount } = query;

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

  let response = { consultations: [], totalCount };

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails[clientId];
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;

    const oneHourBeforeNow = new Date();
    oneHourBeforeNow.setHours(oneHourBeforeNow.getHours() - 1);

    if (consultation.time > oneHourBeforeNow) {
      response.consultations.push({
        consultation_id: consultation.consultation_id,
        chat_id: consultation.chat_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: client.image,
        time: consultation.time,
        status: consultation.status,
        price: consultation.price,
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

  const providerData = await getProviderByIdQuery({
    poolCountry: country,
    provider_id: providerId,
  })
    .then((raw) => {
      if (raw.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        return raw.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  const consultationPrice = providerData["consultation_price"];

  // Add consultation as pending
  const consultation = await addConsultationAsPendingQuery({
    poolCountry: country,
    clientId,
    providerId,
    time,
    price: consultationPrice,
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
  shouldSendNotification = true,
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

  // Send Client Email and Internal notification
  if (shouldSendNotification) {
    const { email: clientEmail, userId: clientUserId } =
      await getClientNotificationsData({
        language,
        country,
        clientId: consultation.client_detail_id,
      }).catch((err) => {
        throw err;
      });

    await produceRaiseNotification({
      channels: [clientEmail ? "email" : "", "in-platform"],
      emailArgs: {
        emailType: "client-consultationConfirmBooking",
        recipientEmail: clientEmail,
      },
      inPlatformArgs: {
        notificationType: "consultation_booking",
        recipientId: clientUserId,
        country: country,
        data: {
          provider_detail_id: consultation.provider_detail_id,
          time: new Date(consultation.time).getTime() / 1000,
          consultationPrice: consultation.price,
        },
      },
      language,
    }).catch(console.log);

    // Send Provider Email and Internal notification
    const { email: providerEmail, userId: providerUserId } =
      await getProviderNotificationsData({
        language,
        country,
        providerId: consultation.provider_detail_id,
      }).catch((err) => {
        throw err;
      });

    await produceRaiseNotification({
      channels: ["email", "in-platform"],
      emailArgs: {
        emailType: "provider-consultationNotifyBooking",
        recipientEmail: providerEmail,
      },
      inPlatformArgs: {
        notificationType: "consultation_booking",
        recipientId: providerUserId,
        country,
        data: {
          client_detail_id: consultation.client_detail_id,
          time: new Date(consultation.time).getTime() / 1000,
          consultationPrice: consultation.price,
        },
      },
      language,
    }).catch(console.log);
  }
  return { success: true, consultation };
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

  // Send Client Email and Internal notification
  const { email: clientEmail, userId: clientUserId } =
    await getClientNotificationsData({
      language,
      country,
      clientId: consultation.client_detail_id,
    }).catch((err) => {
      throw err;
    });

  await produceRaiseNotification({
    channels: [clientEmail ? "email" : "", "in-platform"],
    emailArgs: {
      emailType: "client-consultationNotifySuggestion",
      recipientEmail: clientEmail,
    },
    inPlatformArgs: {
      notificationType: "consultation_suggestion",
      recipientId: clientUserId,
      country: country,
      data: {
        provider_detail_id: consultation.provider_detail_id,
        time: new Date(consultation.time).getTime() / 1000,
        consultation_id: consultation.consultation_id,
        consultationPrice: consultation.price,
      },
    },
    language,
  }).catch(console.log);

  // Send Provider Email and Internal notification
  const { email: providerEmail, userId: providerUserId } =
    await getProviderNotificationsData({
      language,
      country,
      providerId: consultation.provider_detail_id,
    }).catch((err) => {
      throw err;
    });

  await produceRaiseNotification({
    channels: ["email", "in-platform"],
    emailArgs: {
      emailType: "provider-consultationConfirmSuggestion",
      recipientEmail: providerEmail,
    },
    inPlatformArgs: {
      notificationType: "consultation_suggestion",
      recipientId: providerUserId,
      country: country,
      data: {
        client_detail_id: consultation.client_detail_id,
        time: new Date(consultation.time).getTime() / 1000,
        consultationPrice: consultation.price,
      },
    },
    language,
  }).catch(console.log);

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
        const consultation = raw.rows[0];

        // Send Client Email and Internal notification
        const { email: clientEmail, userId: clientUserId } =
          await getClientNotificationsData({
            language,
            country,
            clientId: consultation.client_detail_id,
          }).catch((err) => {
            throw err;
          });

        await produceRaiseNotification({
          channels: [clientEmail ? "email" : "", "in-platform"],
          emailArgs: {
            emailType: "client-consultationConfirmSuggestionBooking",
            recipientEmail: clientEmail,
          },
          inPlatformArgs: {
            notificationType: "consultation_suggestion_booking",
            recipientId: clientUserId,
            country: country,
            data: {
              provider_detail_id: consultation.provider_detail_id,
              time: new Date(consultation.time).getTime() / 1000,
            },
          },
          language,
        }).catch(console.log);

        // Send Provider Email and Internal notification
        const { email: providerEmail, userId: providerUserId } =
          await getProviderNotificationsData({
            language,
            country,
            providerId: consultation.provider_detail_id,
          }).catch((err) => {
            throw err;
          });

        await produceRaiseNotification({
          channels: ["email", "in-platform"],
          emailArgs: {
            emailType: "provider-consultationNotifySuggestionBooking",
            recipientEmail: providerEmail,
          },
          inPlatformArgs: {
            notificationType: "consultation_suggestion_booking",
            recipientId: providerUserId,
            country: country,
            data: {
              client_detail_id: consultation.client_detail_id,
              time: new Date(consultation.time).getTime() / 1000,
            },
          },
          language,
        }).catch(console.log);

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
        const consultation = raw.rows[0];

        // Send Client Email and Internal notification
        const { email: clientEmail, userId: clientUserId } =
          await getClientNotificationsData({
            language,
            country,
            clientId: consultation.client_detail_id,
          }).catch((err) => {
            throw err;
          });

        await produceRaiseNotification({
          channels: [clientEmail ? "email" : "", "in-platform"],
          emailArgs: {
            emailType: "client-consultationConfirmSuggestionCancellation",
            recipientEmail: clientEmail,
          },
          inPlatformArgs: {
            notificationType: "consultation_suggestion_cancellation",
            recipientId: clientUserId,
            country: country,
            data: {
              provider_detail_id: consultation.provider_detail_id,
              time: new Date(consultation.time).getTime() / 1000,
              consultation_id: consultation.consultation_id,
            },
          },
          language,
        }).catch(console.log);

        // Send Provider Email and Internal notification
        const { email: providerEmail, userId: providerUserId } =
          await getProviderNotificationsData({
            language,
            country,
            providerId: consultation.provider_detail_id,
          }).catch((err) => {
            throw err;
          });

        await produceRaiseNotification({
          channels: ["email", "in-platform"],
          emailArgs: {
            emailType: "provider-consultationNotifySuggestionCancellation",
            recipientEmail: providerEmail,
          },
          inPlatformArgs: {
            notificationType: "consultation_suggestion_cancellation",
            recipientId: providerUserId,
            country: country,
            data: {
              client_detail_id: consultation.client_detail_id,
              time: new Date(consultation.time).getTime() / 1000,
            },
          },
          language,
        }).catch(console.log);

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
      const res = await scheduleConsultation({
        country,
        language,
        consultationId: newConsultationId,
        shouldSendNotification: false,
      }).catch((err) => {
        throw err;
      });
      const newConsultation = res.consultation;
      const newConsultationTime =
        new Date(newConsultation.time).getTime() / 1000;

      const consultation = await getConsultationByIdQuery({
        poolCountry: country,
        consultationId,
      })
        .then((raw) => {
          if (raw.rowCount === 0) {
            throw consultationNotFound(language);
          }
          return raw.rows[0];
        })
        .catch((err) => {
          throw err;
        });

      // Send Client Email and Internal notification
      const { email: clientEmail, userId: clientUserId } =
        await getClientNotificationsData({
          language,
          country,
          clientId: consultation.client_detail_id,
        }).catch((err) => {
          throw err;
        });

      await produceRaiseNotification({
        channels: [clientEmail ? "email" : "", "in-platform"],
        emailArgs: {
          emailType: "client-consultationConfirmReschedule",
          recipientEmail: clientEmail,
        },
        inPlatformArgs: {
          notificationType: "consultation_reschedule",
          recipientId: clientUserId,
          country: country,
          data: {
            time: new Date(consultation.time).getTime() / 1000,
            new_consultation_time: newConsultationTime,
            provider_detail_id: consultation.provider_detail_id,
          },
        },
        language,
      }).catch(console.log);

      // Send Provider Email and Internal notification
      const { email: providerEmail, userId: providerUserId } =
        await getProviderNotificationsData({
          language,
          country,
          providerId: consultation.provider_detail_id,
        }).catch((err) => {
          throw err;
        });

      await produceRaiseNotification({
        channels: ["email", "in-platform"],
        emailArgs: {
          emailType: "provider-consultationNotifyReschedule",
          recipientEmail: providerEmail,
        },
        inPlatformArgs: {
          notificationType: "consultation_reschedule",
          recipientId: providerUserId,
          country: country,
          data: {
            time: new Date(consultation.time).getTime() / 1000,
            new_consultation_time: newConsultationTime,
            client_detail_id: consultation.client_detail_id,
          },
        },
        language,
      }).catch(console.log);

      return { success: true };
    })
    .catch((err) => {
      throw err;
    });
};

export const joinConsultation = async ({
  country,
  language,
  consultationId,
  userType,
}) => {
  // Check if the consultation is in the right status
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
    consultationId,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      }

      return raw.rows[0];
    })
    .catch((err) => {
      throw err;
    });

  if (consultation.status !== "scheduled") {
    throw consultationNotScheduled(language);
  }

  // Store the join time for the user type
  if (userType === "client") {
    await joinConsultationClientQuery({
      poolCountry: country,
      consultationId,
    }).catch((err) => {
      throw err;
    });
  } else if (userType === "provider") {
    await joinConsultationProviderQuery({
      poolCountry: country,
      consultationId,
    }).catch((err) => {
      throw err;
    });
  }

  return { success: true };
};

export const leaveConsultation = async ({
  country,
  language,
  userId,
  consultationId,
  userType,
}) => {
  // Store the leave time for the user type and update the status if both users have left
  let newConsultation;

  if (userType === "client") {
    newConsultation = await leaveConsultationClientQuery({
      poolCountry: country,
      consultationId,
    })
      .then(async (raw) => {
        if (raw.rowCount === 0) {
          throw consultationNotFound(language);
        }

        return raw.rows[0];
      })
      .catch((err) => {
        throw err;
      });
  } else if (userType === "provider") {
    newConsultation = await leaveConsultationProviderQuery({
      poolCountry: country,
      consultationId,
    })
      .then(async (raw) => {
        if (raw.rowCount === 0) {
          throw consultationNotFound(language);
        }

        return raw.rows[0];
      })
      .catch((err) => {
        throw err;
      });
  }

  // Update the status of the consultation if both users have left
  if (
    newConsultation.client_leave_time !== null &&
    newConsultation.provider_leave_time !== null
  ) {
    await updateConsultationStatusAsFinishedQuery({
      poolCountry: country,
      consultationId,
    }).catch((err) => {
      throw err;
    });
  }

  const client = new twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  client.video
    .rooms(consultationId)
    .participants(userId)
    .update({
      status: "disconnected",
    })
    .catch((err) => {
      throw err;
    });

  return { success: true };
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
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        const consultation = raw.rows[0];

        // Send Client Email and Internal notification
        const { email: clientEmail, userId: clientUserId } =
          await getClientNotificationsData({
            language,
            country,
            clientId: consultation.client_detail_id,
          }).catch((err) => {
            throw err;
          });

        await produceRaiseNotification({
          channels: [clientEmail ? "email" : "", "in-platform"],
          emailArgs: {
            emailType:
              canceledBy === "client"
                ? "client-consultationConfirmCancellation"
                : "client-consultationNotifyCancellation",
            recipientEmail: clientEmail,
          },
          inPlatformArgs: {
            notificationType:
              canceledBy === "client"
                ? "consultation_cancellation"
                : "consultation_cancellation_provider",
            recipientId: clientUserId,
            country: country,
            data: {
              provider_detail_id: consultation.provider_detail_id,
              time: new Date(consultation.time).getTime() / 1000,
            },
          },
          language,
        }).catch(console.log);

        // Send Provider Email and Internal notification
        const { email: providerEmail, userId: providerUserId } =
          await getProviderNotificationsData({
            language,
            country,
            providerId: consultation.provider_detail_id,
          }).catch((err) => {
            throw err;
          });

        await produceRaiseNotification({
          channels: ["email", "in-platform"],
          emailArgs: {
            emailType:
              canceledBy === "client"
                ? "provider-consultationNotifyCancellation"
                : "provider-consultationConfirmCancellation",
            recipientEmail: providerEmail,
          },
          inPlatformArgs: {
            notificationType:
              canceledBy === "client"
                ? "consultation_cancellation"
                : "consultation_cancellation_provider",
            recipientId: providerUserId,
            country: country,
            data: {
              client_detail_id: consultation.client_detail_id,
              time: new Date(consultation.time).getTime() / 1000,
            },
          },
          language,
        }).catch(console.log);
        return { success: true };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getConsultationTime = async ({
  country,
  language,
  consultationId,
}) => {
  return await getConsultationTimeQuerry({
    poolCountry: country,
    consultationId,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};
