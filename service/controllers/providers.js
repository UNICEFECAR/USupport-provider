/* eslint-disable no-useless-catch */
import AWS from "aws-sdk";
import bcrypt from "bcryptjs";

import {
  getAllActiveProvidersQuery,
  getProviderByIdQuery,
  updateProviderDataQuery,
  checkIfEmailIsUsedQuery,
  createProviderDetailWorkWithLinkQuery,
  deleteProviderDetailWorkWithLinkQuery,
  createProviderDetailLanguageLinkQuery,
  deleteProviderDetailLanguageLinkQuery,
  deleteProviderDataQuery,
  updateProviderImageQuery,
  deleteProviderImageQuery,
  getActivitiesQuery,
  getSponsorAndActiveCampaignsQuery,
  getCampaignIdsForProviderQuery,
  getProviderConductedConsultationsForCampaign,
  enrollProviderInCampaignQuery,
  getProvidersByCampaignIdQuery,
  getCampaignNamesByIds,
  updateProviderStatusQuery,
  getProviderUserIdByDetailIdQuery,
  getProviderStatusQuery,
  addProviderRatingQuery,
} from "#queries/providers";

import {
  getAllConsultationsByProviderIdQuery,
  getAllConsultationsCountQuery,
  getFutureConsultationsCountQuery,
  getProviderConsultationsForCampaign,
} from "#queries/consultation";

import { getMultipleClientsDataByIDs } from "#queries/clients";

import { getCampaignCouponPriceForMultipleIds } from "#queries/sponsors";

import {
  providerNotFound,
  incorrectPassword,
  emailUsed,
  providerHasFutureConsultations,
} from "#utils/errors";
import {
  getEarliestAvailableSlot,
  formatSpecializations,
  getProviderLanguagesAndWorkWith,
  shuffleArray,
  getLatestAvailableSlot,
} from "#utils/helperFunctions";
import { deleteCacheItem } from "#utils/cache";
import {
  assignOrganizationsToProviderQuery,
  removeOrganizationsFromProviderQuery,
} from "#queries/organization";

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;

export const allProviderTypes = [
  "psychologist",
  "psychotherapist",
  "psychiatrist",
  "coach",
];

export const getAllProviders = async ({
  country,
  campaignId,
  offset,
  limit,
  availableAfter,
  availableBefore,
  providerTypes,
  sex,
  maxPrice,
  onlyFreeConsultation,
  language,
  onlyAvailable,
}) => {
  const newOffset = offset === 1 ? 0 : (offset - 1) * limit;
  let filteredProviders = [];
  let providers;
  try {
    if (campaignId) {
      providers = await getProvidersByCampaignIdQuery({
        poolCountry: country,
        campaignId: campaignId,
        limit,
        offset: newOffset,
        maxPrice: maxPrice || 0,
        onlyFreeConsultation: onlyFreeConsultation || false,
        providerTypes: providerTypes || allProviderTypes,
      })
        .then((res) => res.rows)
        .catch((err) => {
          throw err;
        });
    } else {
      providers = await getAllActiveProvidersQuery({
        poolCountry: country,
        limit,
        offset: newOffset,
        maxPrice: maxPrice || 0,
        onlyFreeConsultation: onlyFreeConsultation || false,
        providerTypes: providerTypes || allProviderTypes,
      })
        .then((res) => res.rows)
        .catch((err) => {
          throw err;
        });
    }

    for (let i = 0; i < providers.length; i++) {
      const { languages, workWith } = await getProviderLanguagesAndWorkWith({
        country,
        provider_detail_id: providers[i].provider_detail_id,
      });

      const languageIds = languages.map((x) => x.language_id);

      if (language && !languageIds.includes(language)) {
        continue;
      }

      providers[i].specializations = formatSpecializations(
        providers[i].specializations
      );

      if (sex) {
        const isSexMatching = sex.includes(providers[i].sex);

        if (!isSexMatching) {
          continue;
        }
      }

      providers[i].total_consultations = await getAllConsultationsCountQuery({
        poolCountry: country,
        providerId: providers[i].provider_detail_id,
      })
        .then((res) => {
          return res.rows[0].count;
        })
        .catch((err) => {
          throw err;
        });
      providers[i].earliest_available_slot = await getEarliestAvailableSlot(
        country,
        providers[i].provider_detail_id,
        providers[i].campaign_id
      );

      providers[i].latest_available_slot = await getLatestAvailableSlot(
        country,
        providers[i].provider_detail_id,
        providers[i].campaign_id
      );

      if (
        providers[i].earliest_available_slot &&
        providers[i].latest_available_slot
      ) {
        const providerEarliestAvailable = new Date(
          providers[i].earliest_available_slot
        );

        const providerLatestAvailable = new Date(
          providers[i].latest_available_slot
        );

        if (availableAfter) {
          let availableAfterDate = new Date(Number(availableAfter * 1000));
          availableAfterDate = new Date(availableAfterDate.setHours(0));

          const isAvailableAfter =
            availableAfterDate <= providerEarliestAvailable ||
            availableAfterDate <= providerLatestAvailable;

          if (!isAvailableAfter) {
            continue;
          }
        }

        if (availableBefore) {
          let availableBeforeDate = new Date(Number(availableBefore * 1000));
          availableBeforeDate = new Date(availableBeforeDate.setHours(0));

          const isAvailableBefore =
            availableBeforeDate >= providerLatestAvailable ||
            availableBeforeDate >= providerEarliestAvailable;

          if (!isAvailableBefore) {
            continue;
          }
        }
      } else {
        if (onlyAvailable) {
          continue;
        }
      }

      delete providers[i].street;
      delete providers[i].city;
      delete providers[i].postcode;
      delete providers[i].email;
      delete providers[i].phone;

      providers[i] = {
        ...providers[i],
        languages: languages,
        work_with: workWith,
      };
      filteredProviders.push(providers[i]);
    }
    return filteredProviders;
  } catch (err) {
    throw err;
  }
};

export const getProviderById = async ({
  country,
  language,
  provider_id,
  isRequestedByAdmin,
  campaignId,
}) => {
  return await getProviderByIdQuery({ poolCountry: country, provider_id })
    .then(async (res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      }

      let provider = res.rows[0];

      const { languages, workWith } = await getProviderLanguagesAndWorkWith({
        country,
        provider_detail_id: provider.provider_detail_id,
      });

      provider.specializations = formatSpecializations(
        provider.specializations
      );

      provider.total_consultations = await getAllConsultationsCountQuery({
        poolCountry: country,
        providerId: provider_id,
      })
        .then((res) => {
          return res.rows[0].count;
        })
        .catch((err) => {
          throw err;
        });

      provider.earliest_available_slot = await getEarliestAvailableSlot(
        country,
        provider_id,
        campaignId
      );
      if (!isRequestedByAdmin) {
        delete provider.street;
        delete provider.city;
        delete provider.postcode;
        delete provider.user_id;
        delete provider.email;
        delete provider.phone;
      }

      provider = {
        ...provider,
        languages: languages,
        work_with: workWith,
      };
      return provider;
    })
    .catch((err) => {
      throw err;
    });
};

export const updateProviderData = async ({
  country,
  language,
  provider_id,
  user_id,
  name,
  patronym,
  surname,
  nickname,
  email,
  currentEmail,
  phone,
  specializations,
  street,
  city,
  postcode,
  education,
  sex,
  consultationPrice,
  description,
  workWithIds,
  currentWorkWithIds,
  languageIds,
  currentLanguageIds,
  organizationIds,
  currentOrganizationIds,
  videoLink,
}) => {
  // Check if email is changed
  if (email !== currentEmail) {
    // Check if email is already taken
    await checkIfEmailIsUsedQuery({
      country,
      email,
    })
      .then((res) => {
        if (res.rowCount > 0) {
          throw emailUsed(language);
        }
      })
      .catch((err) => {
        throw err;
      });
  }

  return await updateProviderDataQuery({
    poolCountry: country,
    provider_id,
    name,
    patronym,
    surname,
    nickname,
    email,
    phone,
    specializations,
    street,
    city,
    postcode,
    education,
    sex,
    consultationPrice,
    description,
    videoLink,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        // Compare workWithIds and currentWorkWithIds arrays
        // and delete or insert new workWithIds
        const workWithIdsToDelete = currentWorkWithIds?.filter(
          (id) => !workWithIds.includes(id) // id is not in workWithIds array
        );
        const workWithIdsToInsert = workWithIds?.filter(
          (id) => !currentWorkWithIds.includes(id) // id is not in currentWorkWithIds array
        );

        // For each workWithId to insert, insert it
        workWithIdsToInsert?.forEach(async (id) => {
          await createProviderDetailWorkWithLinkQuery({
            poolCountry: country,
            provider_id,
            workWithId: id,
          }).catch((err) => {
            throw err;
          });
        });

        // For each workWithId to delete, delete it
        workWithIdsToDelete?.forEach(async (id) => {
          await deleteProviderDetailWorkWithLinkQuery({
            poolCountry: country,
            provider_id,
            workWithId: id,
          }).catch((err) => {
            throw err;
          });
        });

        // Compare languageIds and currentLanguageIds arrays
        // and delete or insert new languageIds
        const languageIdsToDelete = currentLanguageIds?.filter(
          (id) => !languageIds.includes(id) // id is not in languageIds array
        );
        const languageIdsToInsert = languageIds?.filter(
          (id) => !currentLanguageIds.includes(id) // id is not in currentLanguageIds array
        );

        // For each languageId to insert, insert it
        languageIdsToInsert?.forEach(async (id) => {
          await createProviderDetailLanguageLinkQuery({
            poolCountry: country,
            provider_id,
            languageId: id,
          }).catch((err) => {
            throw err;
          });
        });

        // For each languageId to delete, delete it
        languageIdsToDelete?.forEach(async (id) => {
          await deleteProviderDetailLanguageLinkQuery({
            poolCountry: country,
            provider_id,
            languageId: id,
          }).catch((err) => {
            throw err;
          });
        });

        // Insert new organizations and delete missing ones
        const organizationsToInsert = organizationIds?.filter(
          (id) => !currentOrganizationIds.includes(id)
        );

        const organizationsToDelete = currentOrganizationIds?.filter(
          (id) => !organizationIds.includes(id)
        );

        await assignOrganizationsToProviderQuery({
          organizationIds: organizationsToInsert,
          providerDetailId: provider_id,
          poolCountry: country,
        }).catch((err) => {
          throw err;
        });

        await removeOrganizationsFromProviderQuery({
          organizationIds: organizationsToDelete,
          providerDetailId: provider_id,
          poolCountry: country,
        }).catch((err) => {
          throw err;
        });

        const cacheKey = `provider_${country}_${user_id}`;
        await deleteCacheItem(cacheKey);

        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const deleteProviderData = async ({
  country,
  language,
  provider_id,
  user_id,
  image,
  password,
  userPassword,
  isRequestedByAdmin,
}) => {
  // Check if provider has consultations in the future
  await getFutureConsultationsCountQuery({
    poolCountry: country,
    providerId: provider_id,
  })
    .then((res) => {
      if (res.rows[0].count > 0) {
        throw providerHasFutureConsultations(language);
      }
    })
    .catch((err) => {
      throw err;
    });

  if (!isRequestedByAdmin) {
    const validatePassword = await bcrypt.compare(password, userPassword);

    if (!validatePassword) {
      throw incorrectPassword(language);
    }
  }

  return await deleteProviderDataQuery({
    poolCountry: country,
    provider_id,
    user_id,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        if (image !== "default") {
          try {
            const s3 = new AWS.S3({
              accessKeyId: AWS_ACCESS_KEY_ID,
              secretAccessKey: AWS_SECRET_ACCESS_KEY,
              region: AWS_REGION,
            });

            const params = {
              Bucket: AWS_BUCKET_NAME,
              Prefix: image,
            };

            const objectVersions = await s3
              .listObjectVersions(params)
              .promise();

            const versions = objectVersions.Versions.map((version) => {
              const deleteParams = {
                Bucket: AWS_BUCKET_NAME,
                Key: version.Key,
                VersionId: version.VersionId,
              };
              return s3.deleteObject(deleteParams).promise();
            });

            await Promise.all(versions);
          } catch (err) {
            throw err;
          }
        }

        const cacheKey = `provider_${country}_${user_id}`;
        await deleteCacheItem(cacheKey);

        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const updateProviderImage = async ({
  country,
  language,
  provider_id,
  image,
  user_id,
}) => {
  return await updateProviderImageQuery({
    poolCountry: country,
    provider_id,
    image,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        const cacheKey = `provider_${country}_${user_id}`;
        await deleteCacheItem(cacheKey);

        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const deleteProviderImage = async ({
  country,
  language,
  provider_id,
  user_id,
}) => {
  return await deleteProviderImageQuery({
    poolCountry: country,
    provider_id,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        const cacheKey = `provider_${country}_${user_id}`;
        await deleteCacheItem(cacheKey);

        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getAllClients = async ({ country, providerId }) => {
  return await getAllConsultationsByProviderIdQuery({
    poolCountry: country,
    providerId,
  })
    .then(async (res) => {
      let consultations = res.rows;

      // Get all clients ids
      const clientDetailIds = Array.from(
        new Set(
          consultations.map((consultation) => consultation.client_detail_id)
        )
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

      // Get all campaign ids
      const campaignIds = Array.from(
        new Set(consultations.map((consultation) => consultation.campaign_id))
      );

      // Get the data for each campaign
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

      // Initialise the clients array
      let clients = [];

      for (let i = 0; i < clientDetailIds.length; i++) {
        const client = clientsDetails.find(
          (x) => x.client_detail_id === clientDetailIds[i]
        );
        const clientName = client.name;
        const clientSurname = client.surname;
        const clientNickname = client.nickname;

        clients.push({
          client_detail_id: client.client_detail_id,
          client_name: clientName
            ? `${clientName} ${clientSurname}`
            : clientNickname,
          client_image: client.image,
          next_consultation: null,
          next_consultation_id: null,
          next_consultation_status: null,
          next_consultation_price: null,
          next_consultation_coupon_price: null,
          chat_id: null,
          past_consultations: 0,
        });
      }

      const oneHourBeforeNow = new Date();
      oneHourBeforeNow.setHours(oneHourBeforeNow.getHours() - 1);

      // For each consultation, add it to the clients array in the right place
      for (let i = 0; i < consultations.length; i++) {
        const consultation = consultations[i];
        const consultationTime = consultation.time;
        const clientDetailId = consultation.client_detail_id;
        const campaignId = consultation.campaign_id;

        const clientIndex = clients.findIndex(
          (client) => client.client_detail_id === clientDetailId
        );

        const campaignData = campaignCouponPrices.find(
          (x) => x.campaign_id === campaignId
        );

        const couponPrice = campaignData?.price_per_coupon;

        if (clientIndex !== -1) {
          if (consultationTime > oneHourBeforeNow) {
            if (
              clients[clientIndex].next_consultation === null ||
              consultationTime < clients[clientIndex].next_consultation
            ) {
              clients[clientIndex].next_consultation = consultationTime;
              clients[clientIndex].next_consultation_id =
                consultation.consultation_id;
              clients[clientIndex].next_consultation_status =
                consultation.status;
              clients[clientIndex].next_consultation_price = consultation.price;
              clients[clientIndex].next_consultation_coupon_price = couponPrice;
              clients[clientIndex].next_consultation_campaign_id =
                campaignData?.campaign_id || null;
              clients[clientIndex].next_consultation_sponsor_name =
                campaignData?.name || null;
              clients[clientIndex].next_consultation_status =
                consultation.status;
              clients[clientIndex].chat_id = consultation.chat_id;
            }
          } else {
            clients[clientIndex].past_consultations += 1;
          }
        }
      }

      return clients;
    })
    .catch((err) => {
      throw err;
    });
};

export const getActivities = async ({ country, providerId }) => {
  const activities = await getActivitiesQuery({
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

  // Make sure there are no duplicate client id's
  const clientDetailIds = Array.from(
    new Set(activities.map((x) => x.client_detail_id))
  );

  const clientDetails = await getMultipleClientsDataByIDs({
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

  const campaignIds = Array.from(new Set(activities.map((x) => x.campaign_id)));

  const campaignNames = await getCampaignNamesByIds({
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

  activities.forEach((consultation, index) => {
    const clientData = clientDetails.find(
      (x) => x.client_detail_id === consultation.client_detail_id
    );

    const campaignName = campaignNames.find(
      (x) => x.campaign_id === consultation.campaign_id
    )?.name;

    activities[index].campaign_name = campaignName;
    activities[index].clientData = clientData;
  });

  return activities;
};

export const getRandomProviders = async ({
  country,
  language,
  numberOfProviders,
}) => {
  let providers = await getAllActiveProvidersQuery({
    poolCountry: country,
    limit: numberOfProviders || 3,
    offset: 1,
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

  for (let i = 0; i < providers.length; i++) {
    providers[i].specializations = formatSpecializations(
      providers[i].specializations
    );

    delete providers[i].street;
    delete providers[i].city;
    delete providers[i].postcode;
    delete providers[i].email;
    delete providers[i].phone;

    providers[i] = {
      ...providers[i],
    };
  }

  return shuffleArray(providers).slice(0, numberOfProviders);
};

export const getCampaigns = async ({ country, providerId }) => {
  const data = await getSponsorAndActiveCampaignsQuery({
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

  const providerCampaignIds = await getCampaignIdsForProviderQuery({
    poolCountry: country,
    providerId,
  }).then((res) => {
    if (res.rowCount === 0) {
      return [];
    } else {
      return res.rows.map((x) => x.campaign_id);
    }
  });

  const conductedConsultationsForCampaign =
    await getProviderConductedConsultationsForCampaign({
      poolCountry: country,
      providerId,
      campaignIds: providerCampaignIds,
    }).then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows;
      }
    });

  for (let i = 0; i < data.length; i++) {
    const campaignId = data[i].campaign_id;
    const conductedConsultations = conductedConsultationsForCampaign.find(
      (x) => x.campaign_id === campaignId
    );
    data[i].conducted_consultations = conductedConsultations
      ? Number(conductedConsultations.count)
      : 0;
  }

  return {
    activeCampaigns: data,
    providerCampaignIds,
  };
};

export const enrollProviderInCampaign = async ({
  country: poolCountry,
  providerId,
  campaignId,
}) => {
  await enrollProviderInCampaignQuery({
    poolCountry,
    providerId,
    campaignId,
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

  return { success: true };
};

export const getConsultationsForCampaign = async ({
  country,
  providerId,
  campaignId,
}) => {
  const consultations = await getProviderConsultationsForCampaign({
    poolCountry: country,
    providerId,
    campaignId,
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

  const clientDetailIds = Array.from(
    new Set(consultations.map((x) => x.client_detail_id))
  );
  const clientsData = await getMultipleClientsDataByIDs({
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

  consultations.forEach((consultation, index) => {
    const clientData = clientsData.find(
      (x) => x.client_detail_id === consultation.client_detail_id
    );
    const clientName = clientData.name;
    const clientSurname = clientData.surname;
    const clientNickname = clientData.nickname;
    const clientImage = clientData.image;

    consultations[index].client_name =
      clientName && clientSurname
        ? `${clientName} ${clientSurname}`
        : clientNickname;
    consultations[index].client_image = clientImage;
  });
  return consultations;
};

export const updateProviderStatus = async ({
  language,
  country,
  providerDetailId,
  status,
}) => {
  return await updateProviderStatusQuery({
    poolCountry: country,
    providerDetailId,
    status,
  })
    .then(async (res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        const providerData = res.rows[0];
        const user_id = await getProviderUserIdByDetailIdQuery({
          poolCountry: country,
          providerDetailId,
        }).then((res) => {
          if (res.rowCount === 0) {
            throw providerNotFound(language);
          } else {
            return res.rows[0].user_id;
          }
        });

        const cacheKey = `provider_${country}_${user_id}`;
        await deleteCacheItem(cacheKey);
        return { success: true, newStatus: providerData.status };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getProviderStatus = async ({
  language,
  country,
  providerDetailId,
}) => {
  return await getProviderStatusQuery({
    poolCountry: country,
    providerDetailId,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const addProviderRating = async ({
  country,
  language,
  providerDetailId,
  rating,
  comment,
}) => {
  return await addProviderRatingQuery({
    poolCountry: country,
    providerDetailId,
    rating,
    comment,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        throw providerNotFound(language);
      } else {
        return res.rows[0];
      }
    })
    .catch((err) => {
      throw err;
    });
};
