/* eslint-disable no-useless-catch */
import AWS from "aws-sdk";
import bcrypt from "bcryptjs";

import {
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

import { providerNotFound, incorrectPassword, emailUsed } from "#utils/errors";

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;

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
  address,
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
    address,
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
