import { getDBPool } from "#utils/dbConfig";

export const getProviderByUserID = async (poolCountry, user_id) =>
  await getDBPool("piiDb", poolCountry).query(
    `
    WITH userData AS (

      SELECT provider_detail_id 
      FROM "user"
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1

    ), providerData AS (

        SELECT provider_detail."provider_detail_id", "name", patronym, surname, nickname, email, phone_prefix, phone, image, specializations, street, city, postcode, education, sex, consultation_price, description, video_link
        FROM provider_detail
          JOIN userData ON userData.provider_detail_id = provider_detail.provider_detail_id
        ORDER BY provider_detail.created_at DESC
        LIMIT 1

    )
    
    SELECT * FROM providerData;
    `,
    [user_id]
  );

export const getProviderEmailAndUserIdQuery = async ({
  poolCountry,
  providerId,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
    SELECT "user".user_id, email, name, patronym, surname
    FROM "user"
      JOIN provider_detail ON "user".provider_detail_id = provider_detail.provider_detail_id
    WHERE provider_detail.provider_detail_id = $1
    LIMIT 1;
    `,
    [providerId]
  );

export const getProviderByIdQuery = async ({ poolCountry, provider_id }) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT provider_detail."provider_detail_id", "name", patronym, surname, nickname, email, phone_prefix, phone, image, specializations, street, city, postcode, education, sex, consultation_price, description, video_link, "user".user_id
      FROM provider_detail
        JOIN "user" ON "user".provider_detail_id = provider_detail.provider_detail_id AND "user".deleted_at IS NULL
      WHERE provider_detail.provider_detail_id = $1
      ORDER BY provider_detail.created_at DESC
      LIMIT 1;
    `,
    [provider_id]
  );

export const getAllProvidersQuery = async ({ poolCountry }) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT provider_detail."provider_detail_id", "name", patronym, surname, nickname, email, phone_prefix, phone, image, specializations, street, city, postcode, education, sex, consultation_price, description, video_link
      FROM provider_detail
        JOIN "user" ON "user".provider_detail_id = provider_detail.provider_detail_id AND "user".deleted_at IS NULL
      ORDER BY provider_detail.name ASC;
    `
  );

export const getProviderWorkWithQuery = async (poolCountry, provider_id) =>
  await getDBPool("piiDb", poolCountry).query(
    `
    WITH workWithIds AS (

      SELECT work_with_id 
      FROM provider_detail_work_with_links
      WHERE provider_detail_id = $1
      ORDER BY created_at DESC

    )

    SELECT "work_with".work_with_id, "work_with".topic
    FROM workWithIds
      JOIN "work_with" ON workWithIds.work_with_id = "work_with".work_with_id

    `,
    [provider_id]
  );

export const getProviderLanguageIdsQuery = async (poolCountry, provider_id) =>
  await getDBPool("piiDb", poolCountry).query(
    `

      SELECT language_id 
      FROM provider_detail_language_links
      WHERE provider_detail_id = $1
      ORDER BY created_at DESC

    `,
    [provider_id]
  );

export const getProviderLanguagesQuery = async (languageIds) =>
  await getDBPool("masterDb").query(
    `

      SELECT language_id, name, alpha2
      FROM language
      WHERE language_id = ANY ($1::UUID[])
      ORDER BY created_at DESC

    `,
    [languageIds]
  );

export const checkIfEmailIsUsedQuery = async ({ country, email }) =>
  await getDBPool("piiDb", country).query(
    `
    SELECT email
    FROM provider_detail
    WHERE email = $1
    `,
    [email]
  );

export const updateProviderDataQuery = async ({
  poolCountry,
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
  videoLink,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      UPDATE provider_detail
      SET name = $1,
          patronym = $2,
          surname = $3,
          nickname = $4,
          email = $5,
          phone_prefix = $6,
          phone = $7,
          specializations = $8,
          street = $9,
          city = $10,
          postcode = $11,
          education = $12,
          sex = $13,
          consultation_price = $14,
          description = $15,
          video_link = $16
      WHERE provider_detail_id = $17
      RETURNING *;
    `,
    [
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
      videoLink,
      provider_id,
    ]
  );

export const createProviderDetailWorkWithLinkQuery = async ({
  poolCountry,
  provider_id,
  workWithId,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        INSERT INTO provider_detail_work_with_links (provider_detail_id, work_with_id)
        VALUES ($1, $2)
        RETURNING *;
    `,
    [provider_id, workWithId]
  );

export const deleteProviderDetailWorkWithLinkQuery = async ({
  poolCountry,
  provider_id,
  workWithId,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        DELETE FROM provider_detail_work_with_links 
        WHERE provider_detail_id = $1 AND work_with_id = $2;
    `,
    [provider_id, workWithId]
  );

export const createProviderDetailLanguageLinkQuery = async ({
  poolCountry,
  provider_id,
  languageId,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        INSERT INTO provider_detail_language_links (provider_detail_id, language_id)
        VALUES ($1, $2)
        RETURNING *;
    `,
    [provider_id, languageId]
  );

export const deleteProviderDetailLanguageLinkQuery = async ({
  poolCountry,
  provider_id,
  languageId,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        DELETE FROM provider_detail_language_links 
        WHERE provider_detail_id = $1 AND language_id = $2;
    `,
    [provider_id, languageId]
  );

export const deleteProviderDataQuery = async ({
  poolCountry,
  provider_id,
  user_id,
}) => {
  const piiPool = getDBPool("piiDb", poolCountry);

  try {
    // Begin transaction
    await piiPool.query("BEGIN");

    // Delete provider data
    const res = await piiPool.query(
      `
          UPDATE provider_detail
          SET name = 'DELETED',
              patronym = 'DELETED',
              surname = 'DELETED',
              nickname = 'DELETED',
              email = 'DELETED',
              image = 'default',
              phone_prefix = 'DELETED',
              phone = 'DELETED',
              specializations = NULL,
              street = 'DELETED',
              city = 'DELETED',
              postcode = 'DELETED',
              education = NULL,
              sex = NULL,
              consultation_price = NULL,
              description = 'DELETED'
          WHERE provider_detail_id = $1
          RETURNING *;
      `,
      [provider_id]
    );

    // Invalide the user
    await piiPool.query(
      `
          UPDATE "user"
          SET deleted_at = NOW()
          WHERE user_id = $1
      `,
      [user_id]
    );

    // Commit transaction
    await piiPool.query("COMMIT");

    return res;
  } catch (e) {
    // Rollback transaction in case of error
    await piiPool.query("ROLLBACK");
    throw e;
  }
};

export const updateProviderImageQuery = async ({
  poolCountry,
  provider_id,
  image,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      UPDATE provider_detail
      SET image = $1
      WHERE provider_detail_id = $2
      RETURNING *;
    `,
    [image, provider_id]
  );

export const deleteProviderImageQuery = async ({ poolCountry, provider_id }) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        UPDATE provider_detail
        SET image = 'default'
        WHERE provider_detail_id = $1
        RETURNING *;
      `,
    [provider_id]
  );

export const getActivitiesQuery = async ({ poolCountry, providerId }) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT client_detail_id, provider_detail_id, time, status, price, type, transaction_log.campaign_id 
      FROM consultation
        INNER JOIN transaction_log ON consultation.consultation_id = transaction_log.consultation_id
      WHERE provider_detail_id = $1 AND (status = 'finished' OR (status = 'scheduled' AND now() > time + interval '1 hour'))
    `,
    [providerId]
  );
};

export const getSponsorAndActiveCampaignsQuery = async ({ poolCountry }) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
      SELECT campaign.* as campaigns_data, sponsor.name as sponsor_name, sponsor.phone_prefix, sponsor.phone, sponsor.image as sponsor_image, sponsor.email
      FROM campaign
          LEFT JOIN sponsor ON  campaign.sponsor_id = sponsor.sponsor_id
    `
  );
};

export const getCampaignIdsForProviderQuery = async ({
  poolCountry,
  providerId,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
      SELECT campaign_id FROM provider_campaign_links
      WHERE provider_detail_id = $1
    `,
    [providerId]
  );
};

export const getProviderConductedConsultationsForCampaign = async ({
  poolCountry,
  providerId,
  campaignIds,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT COUNT(consultation.consultation_id) as count , transaction_log.campaign_id
      FROM consultation
        LEFT JOIN transaction_log on transaction_log.consultation_id = consultation.consultation_id AND transaction_log.campaign_id = ANY($2)
        WHERE provider_detail_id = $1 AND (status = 'finished' OR status = 'scheduled')  AND transaction_log.consultation_id = consultation.consultation_id
      GROUP BY transaction_log.campaign_id
    `,
    [providerId, campaignIds]
  );
};

export const enrollProviderInCampaignQuery = async ({
  poolCountry,
  providerId,
  campaignId,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
      INSERT INTO provider_campaign_links (provider_detail_id, campaign_id)
      VALUES ($1, $2)
      RETURNING *;
    `,
    [providerId, campaignId]
  );
};

export const getProvidersByCampaignIdQuery = async ({
  poolCountry,
  campaignId,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
    SELECT provider_detail."provider_detail_id", provider_detail."name", patronym, surname, nickname, email, phone_prefix, phone, image, specializations, street, city, postcode, education, sex, consultation_price, description, video_link, price_per_coupon, campaign.campaign_id
    FROM provider_detail
      JOIN "user" ON "user".provider_detail_id = provider_detail.provider_detail_id AND "user".deleted_at IS NULL
      JOIN campaign ON campaign.campaign_id = $1
      JOIN provider_campaign_links ON provider_campaign_links.campaign_id = campaign.campaign_id AND provider_campaign_links.provider_detail_id = provider_detail.provider_detail_id
    ORDER BY provider_detail.name ASC;
    `,
    [campaignId]
  );
};

export const getCampaignNamesByIds = async ({ poolCountry, campaignIds }) => {
  return getDBPool("piiDb", poolCountry).query(
    `
        SELECT campaign_id, name
        FROM campaign
        WHERE campaign_id = ANY($1)
    `,
    [campaignIds]
  );
};
