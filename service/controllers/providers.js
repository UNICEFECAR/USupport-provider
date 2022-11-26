/* eslint-disable no-useless-catch */
import AWS from "aws-sdk";
import bcrypt from "bcryptjs";

import {
  getAllProvidersQuery,
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
} from "#queries/providers";

import {
  getAllConsultationsByProviderIdQuery,
  getAllConsultationsCountQuery,
} from "#queries/consultation";

import { getClientByIdQuery } from "#queries/clients";

import {
  providerNotFound,
  clientNotFound,
  incorrectPassword,
  emailUsed,
} from "#utils/errors";

import {
  getEarliestAvailableSlot,
  formatSpecializations,
  getProviderLanguagesAndWorkWith,
} from "#utils/helperFunctions";

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;

export const getAllProviders = async ({ country }) => {
  return await getAllProvidersQuery({ poolCountry: country })
    .then(async (res) => {
      let providers = res.rows;

      for (let i = 0; i < providers.length; i++) {
        const { languages, workWith } = await getProviderLanguagesAndWorkWith({
          country,
          provider_detail_id: providers[i].provider_detail_id,
        });

        providers[i].specializations = formatSpecializations(
          providers[i].specializations
        );

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
          providers[i].provider_detail_id
        );

        providers[i] = {
          ...providers[i],
          languages: languages,
          work_with: workWith,
        };
      }

      return providers;
    })
    .catch((err) => {
      throw err;
    });
};

export const getProviderById = async ({ country, language, provider_id }) => {
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
        provider_id
      );

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
  name,
  patronym,
  surname,
  nickname,
  email,
  currentEmail,
  phonePrefix,
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
    phonePrefix,
    phone,
    specializations,
    street,
    city,
    postcode,
    education,
    sex,
    consultationPrice,
    description,
  })
    .then((res) => {
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
}) => {
  const validatePassword = await bcrypt.compare(password, userPassword);

  if (!validatePassword) {
    throw incorrectPassword(language);
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
}) => {
  return await updateProviderImageQuery({
    poolCountry: country,
    provider_id,
    image,
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

export const deleteProviderImage = async ({
  country,
  language,
  provider_id,
}) => {
  return await deleteProviderImageQuery({
    poolCountry: country,
    provider_id,
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

export const getAllClients = async ({ country, language, providerId }) => {
  return await getAllConsultationsByProviderIdQuery({
    poolCountry: country,
    providerId,
  })
    .then(async (res) => {
      let consultations = res.rows;

      // Get all clients ids
      const clientsToFetch = Array.from(
        new Set(
          consultations.map((consultation) => consultation.client_detail_id)
        )
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

      // Initialise the clients array
      let clients = [];

      for (let i = 0; i < clientsToFetch.length; i++) {
        const client = clientsDetails[clientsToFetch[i]];
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
          past_consultations: 0,
        });
      }

      // For each consultation, add it to the clients array in the right place
      for (let i = 0; i < consultations.length; i++) {
        const consultation = consultations[i];
        const consultationTime = consultation.time;
        const clientDetailId = consultation.client_detail_id;

        const clientIndex = clients.findIndex(
          (client) => client.client_detail_id === clientDetailId
        );

        if (clientIndex !== -1) {
          if (consultationTime > new Date()) {
            if (
              clients[clientIndex].next_consultation === null ||
              consultationTime < clients[clientIndex].next_consultation
            ) {
              clients[clientIndex].next_consultation = consultationTime;
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
