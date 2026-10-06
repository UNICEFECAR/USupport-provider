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
  getClientConsultationsOverlapping,
  getAllConsultationsByProviderIdQuery,
} from "#queries/consultation";

import {
  addTransactionQuery,
  getTrasanctionByConsultationIdQuery,
} from "#queries/transactions";

import {
  getClientByIdQuery,
  getMultipleClientsDataByIDs,
} from "#queries/clients";

import {
  getProviderByIdQuery,
  getProviderStatusQuery,
} from "#queries/providers";

import {
  getCampaignCouponPriceForMultipleIds,
  getCampaignDataByIdQuery,
} from "#queries/sponsors";

import { produceRaiseNotification } from "#utils/kafkaProducers";

import {
  DEFAULT_SLOT_MINUTES,
  getSlotTimestamp,
  hasConsultationEnded,
} from "#utils/slotDuration";

import {
  checkIsSlotAvailable,
  getConsultationsForThreeWeeks,
  getConsultationsForThreeDays,
  getClientNotificationsData,
  getProviderNotificationsData,
  checkCanClientUseCoupon,
  getCountryLabelFromAlpha2,
  addCountryEventRequest,
} from "#utils/helperFunctions";

import {
  slotNotAvailable,
  consultationNotFound,
  clientNotFound,
  consultationNotScheduled,
  transactionNotFound,
  campaignNotFound,
  providerInactive,
  clientCantBook,
  bookingNotAllowed,
  providerNotFound,
  consultationAlreadyStarted,
  cannotRescheduleLessThan24Hours,
} from "#utils/errors";
import { getOrganizationsByIdsQuery } from "#queries/organization";

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

  const campaignIds = Array.from(
    new Set(consultations.map((consultation) => consultation.campaign_id)),
  );

  const campaignCouponPrices = await getCampaignCouponPriceForMultipleIds({
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

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientName = clientDetails.name;
    const clientSurname = clientDetails.surname;
    const clientNickname = clientDetails.nickname;
    const campaignId = consultation.campaign_id;

    const campaignData = campaignCouponPrices.find(
      (x) => x.campaign_id === campaignId,
    );

    const couponPrice = campaignData?.price_per_coupon;
    const sponsorImage = campaignData?.image;

    if (hasConsultationEnded(consultation)) {
      response.push({
        consultation_id: consultation.consultation_id,
        chat_id: consultation.chat_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: clientDetails.image,
        time: consultation.time,
        // These responses are explicit whitelists, so the column is invisible to provider-ui until it is named here.
        duration_minutes: consultation.duration_minutes,
        status: consultation.status,
        price: consultation.price,
        coupon_price: couponPrice,
        sponsor_image: sponsorImage,
        campaign_id: campaignId,
      });
    }
  }

  return response;
};

export const getAllConsultationsSingleWeek = async ({
  country,
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
  const clientDetailIds = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id)),
  );

  let clientsDetails = await getMultipleClientsDataByIDs({
    poolCountry: country,
    clientDetailIds,
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

  const campaignIds = Array.from(
    new Set(consultations.map((consultation) => consultation.campaign_id)),
  );

  const campaignCouponPrices = await getCampaignCouponPriceForMultipleIds({
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

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails.find((x) => x.client_detail_id === clientId);
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;
    const campaignId = consultation.campaign_id;

    const campaignData = campaignCouponPrices.find(
      (x) => x.campaign_id === campaignId,
    );

    const couponPrice = campaignData?.price_per_coupon;
    const sponsorImage = campaignData?.image;
    const sponsorName = campaignData?.name;

    response.push({
      consultation_id: consultation.consultation_id,
      chat_id: consultation.chat_id,
      client_detail_id: clientId,
      client_name: clientName
        ? `${clientName} ${clientSurname}`
        : clientNickname,
      client_image: client.image,
      time: consultation.time,
      duration_minutes: consultation.duration_minutes,
      status: consultation.status,
      price: consultation.price,
      coupon_price: couponPrice,
      sponsor_image: sponsorImage,
      campaign_id: campaignId,
      sponsor_name: sponsorName,
      organization_id: consultation.organization_id,
    });
  }

  return response;
};

export const getAllConsultationsSingleDay = async ({
  country,
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
  const clientDetailIds = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id)),
  );

  // Fetch all the client data at once
  let clientsDetails = await getMultipleClientsDataByIDs({
    poolCountry: country,
    clientDetailIds,
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

  const campaignIds = Array.from(
    new Set(consultations.map((consultation) => consultation.campaign_id)),
  );

  const campaignCouponPrices = await getCampaignCouponPriceForMultipleIds({
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

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails.find((x) => x.client_detail_id === clientId);
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;
    const campaignId = consultation.campaign_id;

    const campaignData = campaignCouponPrices.find(
      (x) => x.campaign_id === campaignId,
    );

    const couponPrice = campaignData?.price_per_coupon;
    const sponsorImage = campaignData?.image;
    const sponsorName = campaignData?.name;

    const res = {
      consultation_id: consultation.consultation_id,
      chat_id: consultation.chat_id,
      client_detail_id: clientId,
      client_name: clientName
        ? `${clientName} ${clientSurname}`
        : clientNickname,
      client_image: client.image,
      time: consultation.time,
      duration_minutes: consultation.duration_minutes,
      status: consultation.status,
      price: consultation.price,
      organization_id: consultation.organization_id,
    };

    if (campaignData) {
      res["sponsor_image"] = sponsorImage;
      res["coupon_price"] = couponPrice;
      res["campaign_id"] = campaignId;
      res["sponsor_name"] = sponsorName;
    }

    response.push(res);
  }

  return response;
};

export const getAllPastConsultations = async ({ country, providerId }) => {
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
  const clientDetailIds = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id)),
  );

  // Fetch the data for the clients at once
  let clientsDetails = await getMultipleClientsDataByIDs({
    poolCountry: country,
    clientDetailIds,
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

  const campaignIds = Array.from(
    new Set(consultations.map((consultation) => consultation.campaign_id)),
  );

  const campaignCouponPrices = await getCampaignCouponPriceForMultipleIds({
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

  const organizationIds = Array.from(
    new Set(consultations.map((consultation) => consultation.organization_id)),
  );

  const organizationsData = await getOrganizationsByIdsQuery({
    poolCountry: country,
    organizationIds,
  }).then((res) => {
    return res.rows || [];
  });

  let response = [];

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails.find((x) => x.client_detail_id === clientId);
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;
    const campaignId = consultation.campaign_id;
    const organizationId = consultation.organization_id;

    const campaignData = campaignCouponPrices.find(
      (x) => x.campaign_id === campaignId,
    );

    const organizationData = organizationsData.find(
      (x) => x.organization_id === organizationId,
    );

    const couponPrice = campaignData?.price_per_coupon;
    const sponsorImage = campaignData?.image;
    const organizationName = organizationData?.name;

    if (
      (hasConsultationEnded(consultation) &&
        consultation.status !== "suggested") ||
      consultation.status === "canceled"
    ) {
      const res = {
        consultation_id: consultation.consultation_id,
        chat_id: consultation.chat_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: client.image,
        time: consultation.time,
        duration_minutes: consultation.duration_minutes,
        status: consultation.status,
        price: consultation.price,
        organization_name: organizationName,
        organization_id: organizationId,
      };

      if (campaignData) {
        res["sponsor_image"] = sponsorImage;
        res["coupon_price"] = couponPrice;
        res["campaign_id"] = campaignId;
      }

      response.push(res);
    }
  }

  return response;
};

export const getAllUpcomingConsultations = async ({
  country,
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
  const clientDetailIds = Array.from(
    new Set(consultations.map((consultation) => consultation.client_detail_id)),
  );
  let clientsDetails = await getMultipleClientsDataByIDs({
    poolCountry: country,
    clientDetailIds,
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

  const campaignIds = Array.from(
    new Set(consultations.map((consultation) => consultation.campaign_id)),
  );

  const campaignCouponPrices = await getCampaignCouponPriceForMultipleIds({
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

  let response = { consultations: [], totalCount };

  for (let i = 0; i < consultations.length; i++) {
    const consultation = consultations[i];
    const clientId = consultation.client_detail_id;
    const client = clientsDetails.find((x) => x.client_detail_id === clientId);
    const clientName = client.name;
    const clientSurname = client.surname;
    const clientNickname = client.nickname;
    const campaignId = consultation.campaign_id;

    const campaignData = campaignCouponPrices.find(
      (x) => x.campaign_id === campaignId,
    );

    const couponPrice = campaignData?.price_per_coupon;
    const sponsorImage = campaignData?.image;
    const sponsorName = campaignData?.name;

    if (!hasConsultationEnded(consultation)) {
      const res = {
        consultation_id: consultation.consultation_id,
        chat_id: consultation.chat_id,
        client_detail_id: clientId,
        client_name: clientName
          ? `${clientName} ${clientSurname}`
          : clientNickname,
        client_image: client.image,
        time: consultation.time,
        duration_minutes: consultation.duration_minutes,
        status: consultation.status,
        price: consultation.price,
        organization_id: consultation.organization_id,
      };

      if (campaignData) {
        res["sponsor_image"] = sponsorImage;
        res["coupon_price"] = couponPrice;
        res["campaign_id"] = campaignId;
        res["sponsor_name"] = sponsorName;
      }

      response.consultations.push(res);
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
  userId,
  rescheduleCampaignSlot = false,
  requestedBy,
  bookedFrom,
  durationMinutes: requestedDurationMinutes,
}) => {
  const isSlotAvailable = await checkIsSlotAvailable(
    country,
    providerId,
    time,
    requestedDurationMinutes,
  );
  if (!isSlotAvailable) throw slotNotAvailable(language);

  // checkIsSlotAvailable has confirmed the provider's own slots tile this
  // length exactly, so it is safe to book even though the client asked for it.
  const durationMinutes =
    isSlotAvailable.duration_minutes || DEFAULT_SLOT_MINUTES;

  // Check if the client is free for the whole consultation, not just its start
  const isClientFree = await getClientConsultationsOverlapping({
    poolCountry: country,
    clientId,
    time: getSlotTimestamp(time),
    durationMinutes,
  })
    .then((res) => {
      if (res.rowCount === 0) return true;
      else return false;
    })
    .catch((err) => {
      throw err;
    });

  if (!isClientFree) {
    if (requestedBy === "client") {
      throw bookingNotAllowed(language);
    } else {
      throw clientCantBook(language);
    }
  }

  const providerData = await getProviderByIdQuery({
    poolCountry: country,
    provider_id: providerId,
    languageId: null,
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

  const campaignId =
    typeof time === "object" && time.campaign_id ? time.campaign_id : null;

  let campaignData;

  if (campaignId) {
    campaignData = await getCampaignDataByIdQuery({
      poolCountry: country,
      campaignId,
    }).then((res) => {
      if (res.rowCount === 0) {
        throw campaignNotFound(language);
      } else {
        return res.rows[0];
      }
    });

    if (!rescheduleCampaignSlot) {
      const canUseCoupon = await checkCanClientUseCoupon({
        couponCode: campaignData.coupon_code,
        country,
        language,
        userId,
      }).catch((err) => {
        throw err;
      });

      if (canUseCoupon.error) {
        throw canUseCoupon.error;
      }
    }
  }
  // Add consultation as pending
  const consultation = await addConsultationAsPendingQuery({
    poolCountry: country,
    clientId,
    providerId,
    time: typeof time === "object" ? time.time : time,
    price: campaignId ? campaignData.price_per_coupon : consultationPrice,
    campaignId,
    organizationId: isSlotAvailable?.organization_id || null,
    bookedFrom,
    durationMinutes,
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
  language, // language of the client
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
      bookedFrom: consultation.booked_from,
    });
  } else {
    const consultationTime = new Date(consultation.time).getTime() / 1000;

    // Check if slot is still available
    // Re-check at the length this consultation was actually booked at. Without
    // it, an hour assembled from two half-hour slots would be re-validated as a
    // single half hour and silently recreated at 30 minutes.
    const isSlotAvailable = await checkIsSlotAvailable(
      country,
      consultation.provider_detail_id,
      consultationTime,
      consultation.duration_minutes,
    );
    if (!isSlotAvailable) throw slotNotAvailable(language);

    // Check if the provider is active
    const providerStatus = await getProviderStatusQuery({
      poolCountry: country,
      providerId: consultation.provider_detail_id,
    }).then((res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        return res.rows[0].status;
      }
    });
    if (providerStatus === "inactive") {
      throw providerInactive(language);
    }

    // Add consultation as scheduled.
    // Also a brand new row - carry the length across explicitly.
    await addConsultationAsScheduledQuery({
      poolCountry: country,
      client_id: consultation.client_detail_id,
      provider_id: consultation.provider_detail_id,
      time: consultationTime,
      durationMinutes:
        isSlotAvailable.duration_minutes ||
        consultation.duration_minutes ||
        DEFAULT_SLOT_MINUTES,
    }).catch((err) => {
      throw err;
    });
  }

  if (consultation.campaign_id || !consultation.price) {
    await addTransactionQuery({
      poolCountry: country,
      type: consultation.campaign_id ? "coupon" : "card",
      consultationId: consultationId,
      paymentIntent: null,
      paymentRefundId: null,
      campaignId: consultation.campaign_id,
    })
      .then(async () => {
        if (shouldSendNotification) {
          await addCountryEventRequest({
            country,
            language,
            eventType: `${
              consultation.booked_from || "mobile"
            }_consultation_scheduled`,
            clientDetailId: consultation.client_detail_id,
          }).catch((err) => {
            console.log(
              new Date().toISOString(),
              " - Error adding country event for consultation scheduled",
              err,
            );
          });
        }
      })
      .catch((err) => {
        throw err;
      });
  } else if (consultation.price) {
    // The separate if statement is on purpose
    if (shouldSendNotification) {
      await addCountryEventRequest({
        country,
        language,
        eventType: `${
          consultation.booked_from || "mobile"
        }_consultation_scheduled`,
        clientDetailId: consultation.client_detail_id,
      }).catch((err) => {
        console.log(
          new Date().toISOString(),
          " - Error adding country event for consultation scheduled",
          err,
        );
      });
    }
  }

  if (shouldSendNotification) {
    // Get client notification data
    const {
      email: clientEmail,
      userId: clientUserId,
      pushTokensArray,
    } = await getClientNotificationsData({
      language,
      country,
      clientId: consultation.client_detail_id,
    }).catch((err) => {
      throw err;
    });

    // Get provider notification data
    // Note that this notification is raised when the client schedules a consultation, so the language comes from the client.
    // To avoid sending the notification in the wrong language, we get the providers's language from the DB
    const {
      email: providerEmail,
      userId: providerUserId,
      fullName: providerName,
      language: providerLanguage,
    } = await getProviderNotificationsData({
      language,
      country,
      providerId: consultation.provider_detail_id,
    }).catch((err) => {
      throw err;
    });

    const baseArgs = {
      notificationType: "consultation_booking",
      country: country,
    };
    const countryLabel = getCountryLabelFromAlpha2(country);
    const baseArgsData = {
      time: new Date(consultation.time).getTime() / 1000,
      // The notification menus render a real end time from this. Leave it out
      // and a 30-minute consultation is announced as an hour long.
      duration_minutes: consultation.duration_minutes,
      consultationPrice: consultation.price,
      countryLabel,
    };

    // Send Client Email and Internal notification
    await produceRaiseNotification({
      channels: [clientEmail ? "email" : "", "in-platform", "push"],
      emailArgs: {
        emailType: "client-consultationConfirmBooking",
        recipientEmail: clientEmail,
        recipientUserType: "client",
        data: {
          countryLabel,
          time: new Date(consultation.time).getTime() / 1000,
          durationMinutes: consultation.duration_minutes,
        },
      },
      inPlatformArgs: {
        recipientId: clientUserId,
        data: {
          provider_detail_id: consultation.provider_detail_id,
          ...baseArgsData,
        },
        ...baseArgs,
      },
      pushArgs: {
        pushTokensArray,
        data: {
          providerName,
          client_detail_id: consultation.client_detail_id,
          ...baseArgsData,
        },
        ...baseArgs,
      },
      language,
    }).catch(console.log);

    // Send Provider Email and Internal notification
    await produceRaiseNotification({
      channels: ["email", "in-platform"],
      emailArgs: {
        emailType: "provider-consultationNotifyBooking",
        recipientEmail: providerEmail,
        recipientUserType: "provider",
        data: {
          countryLabel,
          time: new Date(consultation.time).getTime() / 1000,
          durationMinutes: consultation.duration_minutes,
        },
      },
      inPlatformArgs: {
        recipientId: providerUserId,
        data: {
          client_detail_id: consultation.client_detail_id,
          ...baseArgsData,
        },
        ...baseArgs,
      },
      language: providerLanguage,
    }).catch(console.log);
  }

  const providerData = await getProviderByIdQuery({
    poolCountry: country,
    provider_id: consultation.provider_detail_id,
  })
    .then((raw) => {
      if (raw.rowCount === 0) {
        return {
          name: "DELETED",
          surname: "DELETED",
          patronym: null,
          image: "default",
        };
      } else {
        return raw.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });

  const providerFullName = providerData.patronym
    ? `${providerData.name} ${providerData.patronym} ${providerData.surname}`
    : `${providerData.name} ${providerData.surname}`;

  return {
    success: true,
    consultation: {
      ...consultation,
      provider_name: providerFullName,
      provider_image: providerData.image,
    },
  };
};

export const suggestConsultation = async ({
  country,
  language, // Language of the provider
  consultationId,
  providerDetailId,
  isSuggestingNewTime,
}) => {
  const providerStatus = await getProviderStatusQuery({
    poolCountry: country,
    providerDetailId,
  }).then((res) => {
    if (res.rowCount === 0) {
      throw providerNotFound(language);
    } else {
      return res.rows[0].status;
    }
  });

  if (providerStatus === "inactive") {
    throw providerInactive(language);
  }

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

  // Check if the client is free for the whole consultation, not just its start
  const isClientFree = await getClientConsultationsOverlapping({
    poolCountry: country,
    clientId: consultation.client_detail_id,
    time: new Date(consultation.time).getTime() / 1000,
    durationMinutes: consultation.duration_minutes || DEFAULT_SLOT_MINUTES,
  })
    .then((res) => {
      if (res.rowCount === 0) return true;
      else {
        console.log(res.rows);
        return false;
      }
    })
    .catch((err) => {
      throw err;
    });

  if (!isClientFree) throw clientCantBook(language);

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
    // Re-check at the length this consultation was actually booked at. Without
    // it, an hour assembled from two half-hour slots would be re-validated as a
    // single half hour and silently recreated at 30 minutes.
    const isSlotAvailable = await checkIsSlotAvailable(
      country,
      consultation.provider_detail_id,
      consultationTime,
      consultation.duration_minutes,
    );
    if (!isSlotAvailable) throw slotNotAvailable(language);

    // Add consultation as suggested.
    // This creates a brand new row, so the length has to be carried over
    // explicitly - otherwise it silently falls back to the 60-minute default.
    await addConsultationAsSuggestedQuery({
      poolCountry: country,
      client_id: consultation.client_detail_id,
      provider_id: consultation.provider_detail_id,
      time: consultationTime,
      durationMinutes:
        isSlotAvailable.duration_minutes ||
        consultation.duration_minutes ||
        DEFAULT_SLOT_MINUTES,
    }).catch((err) => {
      throw err;
    });
  }

  // Provider notification data
  const {
    email: providerEmail,
    userId: providerUserId,
    fullName: providerName,
  } = await getProviderNotificationsData({
    language,
    country,
    providerId: consultation.provider_detail_id,
  }).catch((err) => {
    throw err;
  });

  // Client notification data
  // Note that this notification is raised when the provider suggests a consultation, so the language comes from the provider.
  // To avoid sending the notification in the wrong language, we get the client's language from the DB
  const {
    email: clientEmail,
    userId: clientUserId,
    pushTokensArray,
    language: clientLanguage,
  } = await getClientNotificationsData({
    language,
    country,
    clientId: consultation.client_detail_id,
  }).catch((err) => {
    throw err;
  });

  const baseArgs = {
    notificationType: "consultation_suggestion",
    country: country,
  };

  const baseDataArgs = {
    time: new Date(consultation.time).getTime() / 1000,
    duration_minutes: consultation.duration_minutes,
    consultation_id: consultation.consultation_id,
    consultationPrice: consultation.price,
  };

  const countryLabel = getCountryLabelFromAlpha2(country);

  // Send Client Email and Internal notification
  await produceRaiseNotification({
    channels: [clientEmail ? "email" : "", "in-platform", "push"],
    emailArgs: {
      emailType: "client-consultationNotifySuggestion",
      recipientEmail: clientEmail,
      recipientUserType: "client",
      data: {
        countryLabel,
        bookingDate: new Date(consultation.time).toISOString(),
        providerName,
        isSuggestingNewTime,
      },
    },
    inPlatformArgs: {
      recipientId: clientUserId,
      data: {
        provider_detail_id: consultation.provider_detail_id,
        ...baseDataArgs,
      },
      ...baseArgs,
    },
    pushArgs: {
      pushTokensArray,
      data: {
        providerName,
        client_detail_id: consultation.client_detail_id,
        ...baseDataArgs,
      },
      ...baseArgs,
    },
    language: clientLanguage,
  }).catch(console.log);

  // Send Provider Email and Internal notification
  await produceRaiseNotification({
    channels: ["email", "in-platform"],
    emailArgs: {
      emailType: "provider-consultationConfirmSuggestion",
      recipientEmail: providerEmail,
      recipientUserType: "provider",
      data: {
        countryLabel,
      },
    },
    inPlatformArgs: {
      notificationType: "consultation_suggestion",
      recipientId: providerUserId,
      country: country,
      data: {
        client_detail_id: consultation.client_detail_id,
        time: new Date(consultation.time).getTime() / 1000,
        duration_minutes: consultation.duration_minutes,
        consultationPrice: consultation.price,
      },
    },
    language,
  }).catch(console.log);

  return { success: true };
};

export const acceptSuggestedConsultation = async ({
  country,
  language, // language of the client
  consultationId,
  bookedFrom,
}) => {
  // Check if consultation exists
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
    consultationId,
  }).then((raw) => {
    if (raw.rowCount === 0) {
      throw consultationNotFound(language);
    } else {
      return raw.rows[0];
    }
  });

  // Check if the client is free for the whole consultation, not just its start
  const isClientFree = await getClientConsultationsOverlapping({
    poolCountry: country,
    clientId: consultation.client_detail_id,
    time: new Date(consultation.time).getTime() / 1000,
    durationMinutes: consultation.duration_minutes || DEFAULT_SLOT_MINUTES,
  })
    .then((res) => {
      if (res.rowCount === 0) return true;
      else return false;
    })
    .catch((err) => {
      throw err;
    });

  if (!isClientFree) throw bookingNotAllowed(language);

  return await updateConsultationStatusAsScheduledQuery({
    poolCountry: country,
    consultationId,
    bookedFrom,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        const consultation = raw.rows[0];

        console.log("Add event line 1166");
        await addCountryEventRequest({
          country,
          language,
          eventType: `${
            consultation.booked_from || "mobile"
          }_consultation_scheduled`,
          clientDetailId: consultation.client_detail_id,
        }).catch((err) => {
          console.log(
            new Date().toISOString(),
            " - Error adding country event for consultation scheduled",
            err,
          );
        });

        // Get notification data for the provider
        // Note that this notification is raised when the client accepts a consultation,
        // so the language comes from the client.
        // To avoid sending the notification in the wrong language, we get the provider's language from the DB
        const {
          email: providerEmail,
          userId: providerUserId,
          fullName: providerName,
          language: providerLanguage,
        } = await getProviderNotificationsData({
          language,
          country,
          providerId: consultation.provider_detail_id,
        }).catch((err) => {
          throw err;
        });

        // Get notification data for the client
        const {
          email: clientEmail,
          userId: clientUserId,
          pushTokensArray,
        } = await getClientNotificationsData({
          language,
          country,
          clientId: consultation.client_detail_id,
        }).catch((err) => {
          throw err;
        });

        const baseArgs = {
          notificationType: "consultation_suggestion_booking",
          country: country,
        };

        const baseDataArgs = {
          time: new Date(consultation.time).getTime() / 1000,
          duration_minutes: consultation.duration_minutes,
        };

        const countryLabel = getCountryLabelFromAlpha2(country);

        // Send Client Email and Internal notification
        await produceRaiseNotification({
          channels: [clientEmail ? "email" : "", "in-platform", "push"],
          emailArgs: {
            emailType: "client-consultationConfirmSuggestionBooking",
            recipientEmail: clientEmail,
            recipientUserType: "client",
            data: {
              countryLabel,
            },
          },
          inPlatformArgs: {
            recipientId: clientUserId,
            data: {
              provider_detail_id: consultation.provider_detail_id,
              ...baseDataArgs,
            },
            ...baseArgs,
          },
          pushArgs: {
            pushTokensArray,
            data: {
              providerName,
              ...baseDataArgs,
            },
            ...baseArgs,
          },
          language,
        }).catch(console.log);

        // Send Provider Email and Internal notification
        await produceRaiseNotification({
          channels: ["email", "in-platform"],
          emailArgs: {
            emailType: "provider-consultationNotifySuggestionBooking",
            recipientEmail: providerEmail,
            recipientUserType: "provider",
            data: {
              countryLabel,
            },
          },
          inPlatformArgs: {
            recipientId: providerUserId,
            data: {
              client_detail_id: consultation.client_detail_id,
              ...baseDataArgs,
            },
            ...baseArgs,
          },
          language: providerLanguage,
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
  language, // language of the client
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

        // Get notification data for the provider
        // Note that this notification is raised when the client rejects a consultation, so the language comes from the client.
        // To avoid sending the notification in the wrong language, we get the provider's language from the DB
        const {
          email: providerEmail,
          userId: providerUserId,
          fullName: providerName,
          language: providerLanguage,
        } = await getProviderNotificationsData({
          language,
          country,
          providerId: consultation.provider_detail_id,
        }).catch((err) => {
          throw err;
        });

        // Get notification data for the client
        const {
          email: clientEmail,
          userId: clientUserId,
          pushTokensArray,
        } = await getClientNotificationsData({
          language,
          country,
          clientId: consultation.client_detail_id,
        }).catch((err) => {
          throw err;
        });

        const baseArgs = {
          notificationType: "consultation_suggestion_cancellation",
          country: country,
        };

        const baseDataArgs = {
          time: new Date(consultation.time).getTime() / 1000,
          duration_minutes: consultation.duration_minutes,
          consultation_id: consultation.consultation_id,
        };

        const countryLabel = getCountryLabelFromAlpha2(country);

        // Send Client Email and Internal notification
        await produceRaiseNotification({
          channels: [clientEmail ? "email" : "", "in-platform", "push"],
          emailArgs: {
            emailType: "client-consultationConfirmSuggestionCancellation",
            recipientEmail: clientEmail,
            recipientUserType: "client",
            data: {
              countryLabel,
            },
          },
          inPlatformArgs: {
            recipientId: clientUserId,
            data: {
              provider_detail_id: consultation.provider_detail_id,
              ...baseDataArgs,
            },
            ...baseArgs,
          },
          pushArgs: {
            pushTokensArray,
            data: {
              providerName,
              ...baseDataArgs,
            },
            ...baseArgs,
          },
          language,
        }).catch(console.log);

        // Send Provider Email and Internal notification
        await produceRaiseNotification({
          channels: ["email", "in-platform"],
          emailArgs: {
            emailType: "provider-consultationNotifySuggestionCancellation",
            recipientEmail: providerEmail,
            recipientUserType: "provider",
            data: {
              countryLabel,
            },
          },
          inPlatformArgs: {
            recipientId: providerUserId,
            data: {
              client_detail_id: consultation.client_detail_id,
              ...baseDataArgs,
            },
            ...baseArgs,
          },
          language: providerLanguage,
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
  language, // language of the client
  consultationId,
  newConsultationId,
}) => {
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
    consultationId,
  }).then((res) => {
    if (res.rowCount === 0) {
      throw consultationNotFound(language);
    }
    return res.rows[0];
  });

  // Dont allow consultation rescheduling less than 24 hours before it starts
  if (
    new Date(consultation.time).getTime() <
    new Date().getTime() + 24 * 60 * 60 * 1000
  ) {
    throw cannotRescheduleLessThan24Hours(language);
  }

  return await rescheduleConsultationQuery({
    poolCountry: country,
    consultationId,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      }
      const oldConsultation = raw.rows[0];
      if (oldConsultation.price > 0) {
        // Find transaction and get the payment intent id from it if it exists.
        const transaction = await getTrasanctionByConsultationIdQuery({
          poolCountry: country,
          consultationId,
        })
          .then((res) => {
            if (res.rowCount === 0) {
              throw transactionNotFound(language);
            } else {
              return res.rows[0];
            }
          })
          .catch((err) => {
            throw err;
          });

        // Add new transaction to database.
        await addTransactionQuery({
          poolCountry: country,
          type: transaction.type,
          consultationId: newConsultationId,
          paymentIntent: transaction.payment_intent,
          paymentRefundId: null,
        })
          .then((raw) => {
            if (raw.rowCount === 0) {
              throw transactionNotFound(language);
            } else {
              return raw.rows[0];
            }
          })
          .catch((err) => {
            throw err;
          });
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

      // Get notification data for the provider
      // Note that this notification is raised when the client reschedules a consultation, so the language comes from the client.
      // To avoid sending the notification in the wrong language, we get the provider's language from the DB
      const {
        email: providerEmail,
        userId: providerUserId,
        fullName: providerName,
        language: providerLanguage,
      } = await getProviderNotificationsData({
        language,
        country,
        providerId: consultation.provider_detail_id,
      }).catch((err) => {
        throw err;
      });

      // Get notification data for the client
      const {
        email: clientEmail,
        userId: clientUserId,
        pushTokensArray,
      } = await getClientNotificationsData({
        language,
        country,
        clientId: consultation.client_detail_id,
      }).catch((err) => {
        throw err;
      });

      const baseArgs = {
        notificationType: "consultation_reschedule",
        country: country,
      };

      const baseDataArgs = {
        time: new Date(consultation.time).getTime() / 1000,
        duration_minutes: consultation.duration_minutes,
        new_consultation_time: newConsultationTime,
        // A reschedule can move a 60-minute consultation onto a 30-minute slot,
        // so the two ends of this notification need their own lengths.
        new_consultation_duration_minutes: newConsultation.duration_minutes,
      };

      const countryLabel = getCountryLabelFromAlpha2(country);

      // Send Client Email and Internal notification
      await produceRaiseNotification({
        channels: [clientEmail ? "email" : "", "in-platform", "push"],
        emailArgs: {
          emailType: "client-consultationConfirmReschedule",
          recipientEmail: clientEmail,
          recipientUserType: "client",
          data: {
            countryLabel,
          },
        },
        inPlatformArgs: {
          recipientId: clientUserId,
          data: {
            provider_detail_id: consultation.provider_detail_id,
            ...baseDataArgs,
          },
          ...baseArgs,
        },
        pushArgs: {
          pushTokensArray,
          data: {
            providerName,
            ...baseDataArgs,
          },
          ...baseArgs,
        },
        language,
      }).catch(console.log);

      // Send Provider Email and Internal notification
      await produceRaiseNotification({
        channels: ["email", "in-platform"],
        emailArgs: {
          emailType: "provider-consultationNotifyReschedule",
          recipientEmail: providerEmail,
          recipientUserType: "provider",
          data: {
            countryLabel,
          },
        },
        inPlatformArgs: {
          recipientId: providerUserId,
          data: {
            client_detail_id: consultation.client_detail_id,
            ...baseDataArgs,
          },
          ...baseArgs,
        },
        language: providerLanguage,
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

  if (
    consultation.status !== "scheduled" &&
    consultation.status !== "finished"
  ) {
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

  // const client = new twilio(
  //   process.env.TWILIO_ACCOUNT_SID,
  //   process.env.TWILIO_AUTH_TOKEN
  // );

  // client.video
  //   .rooms(consultationId)
  //   .participants(userId)
  //   .update({
  //     status: "disconnected",
  //   })
  //   .catch((err) => {
  //     throw err;
  //   });

  return { success: true };
};

export const cancelConsultation = async ({
  country,
  language,
  consultationId,
  canceledBy,
  isSuggesting = false,
}) => {
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
    consultationId,
  }).then((res) => {
    if (res.rowCount === 0) {
      throw consultationNotFound(language);
    }
    return res.rows[0];
  });

  const now = new Date();
  const consultationTime = new Date(consultation.time);

  if (consultationTime <= now) {
    throw consultationAlreadyStarted(language);
  }

  return await cancelConsultationQuery({
    poolCountry: country,
    consultationId,
    canceledBy,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      } else {
        const consultation = raw.rows[0];

        // Add country event for consultation cancellation
        const eventType =
          consultation.status === "canceled"
            ? `${consultation.booked_from || "mobile"}_consultation_canceled`
            : `${
                consultation.booked_from || "mobile"
              }_consultation_late_canceled`;

        await addCountryEventRequest({
          country,
          language,
          eventType,
          clientDetailId: consultation.client_detail_id,
        }).catch((err) => {
          console.log(
            new Date().toISOString(),
            " - Error adding country event for consultation cancellation",
            err,
          );
        });

        // If the consultation is canceled in order to suggest a new time, don't send emails
        if (!isSuggesting) {
          // Get notification data for the provider
          const {
            email: providerEmail,
            userId: providerUserId,
            fullName: providerName,
            language: providerLanguage,
          } = await getProviderNotificationsData({
            language,
            country,
            providerId: consultation.provider_detail_id,
          }).catch((err) => {
            throw err;
          });

          // Get notification data for the client
          const {
            email: clientEmail,
            userId: clientUserId,
            pushTokensArray,
            language: clientLanguage,
          } = await getClientNotificationsData({
            language,
            country,
            clientId: consultation.client_detail_id,
          }).catch((err) => {
            throw err;
          });

          const countryLabel = getCountryLabelFromAlpha2(country);

          // Send Client Email and Internal notification
          await produceRaiseNotification({
            channels: [clientEmail ? "email" : "", "in-platform", "push"],
            emailArgs: {
              emailType:
                canceledBy === "client"
                  ? "client-consultationConfirmCancellation"
                  : "client-consultationNotifyCancellation",
              recipientEmail: clientEmail,
              recipientUserType: "client",
              data: {
                countryLabel,
              },
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
                duration_minutes: consultation.duration_minutes,
              },
            },
            pushArgs: {
              notificationType: "consultation_cancellation",
              pushTokensArray,
              data: {
                providerName,
                time: new Date(consultation.time).getTime() / 1000,
                duration_minutes: consultation.duration_minutes,
                canceledBy,
              },
            },
            language: clientLanguage,
          }).catch(console.log);

          // Send Provider Email and Internal notification
          await produceRaiseNotification({
            channels: ["email", "in-platform"],
            emailArgs: {
              emailType:
                canceledBy === "client"
                  ? "provider-consultationNotifyCancellation"
                  : "provider-consultationConfirmCancellation",
              recipientEmail: providerEmail,
              recipientUserType: "provider",
              data: {
                countryLabel,
              },
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
                duration_minutes: consultation.duration_minutes,
              },
            },
            language: providerLanguage,
          }).catch(console.log);
        }
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
