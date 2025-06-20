import { allProviderTypes } from "#controllers/providers";
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
    SELECT 
        provider_detail.provider_detail_id, 
        provider_detail.name, 
        provider_detail.patronym, 
        provider_detail.surname, 
        provider_detail.nickname, 
        provider_detail.email, 
        provider_detail.phone, 
        provider_detail.image, 
        provider_detail.specializations, 
        provider_detail.street, 
        provider_detail.city, 
        provider_detail.postcode, 
        provider_detail.education, 
        provider_detail.sex, 
        provider_detail.consultation_price, 
        provider_detail.description, 
        provider_detail.video_link, 
        provider_detail.status,
        JSON_AGG(
            json_build_object(
                'organization_id', organization_provider_links.organization_id,
                'name', organization.name
            )
        ) AS organizations
    FROM 
        provider_detail
    JOIN 
        userData ON userData.provider_detail_id = provider_detail.provider_detail_id
    LEFT JOIN 
        organization_provider_links ON (organization_provider_links.provider_detail_id = provider_detail.provider_detail_id AND organization_provider_links.is_deleted = false)
    LEFT JOIN 
        organization ON organization_provider_links.organization_id = organization.organization_id
    GROUP BY 
        provider_detail.provider_detail_id, 
        provider_detail.name, 
        provider_detail.patronym, 
        provider_detail.surname, 
        provider_detail.nickname, 
        provider_detail.email, 
        provider_detail.phone, 
        provider_detail.image, 
        provider_detail.specializations, 
        provider_detail.street, 
        provider_detail.city, 
        provider_detail.postcode, 
        provider_detail.education, 
        provider_detail.sex, 
        provider_detail.consultation_price, 
        provider_detail.description, 
        provider_detail.video_link, 
        provider_detail.status
    ORDER BY 
        provider_detail.created_at DESC
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
    SELECT "user".user_id, email, name, patronym, surname, "user".language
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
      SELECT provider_detail."provider_detail_id",
             provider_detail."name", patronym, surname, nickname, provider_detail.email, phone,
             image, specializations, street, city, postcode, education,
             sex, consultation_price, description, video_link, "user".user_id,
             JSON_AGG(
                json_build_object(
                  'organization_id', organization_provider_links.organization_id,
                  'name', organization.name
                )
             ) as organizations
      FROM provider_detail
        JOIN "user" ON "user".provider_detail_id = provider_detail.provider_detail_id AND "user".deleted_at IS NULL
        LEFT JOIN organization_provider_links ON organization_provider_links.provider_detail_id = provider_detail.provider_detail_id
        LEFT JOIN organization ON organization_provider_links.organization_id = organization.organization_id
      WHERE provider_detail.provider_detail_id = $1
      GROUP BY provider_detail."provider_detail_id", "user".user_id
      ORDER BY provider_detail.created_at DESC
      LIMIT 1;
    `,
    [provider_id]
  );

export const getAllActiveProvidersQuery = async ({
  poolCountry,
  limit,
  offset,
  maxPrice = 0,
  onlyFreeConsultation = false,
  providerTypes = allProviderTypes,
  startDate,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
      WITH provider_filtered AS (
        SELECT provider_detail."provider_detail_id", "name", patronym, surname, nickname, email, phone, image, specializations, 
              street, city, postcode, education, sex, consultation_price, description, video_link, status
        FROM provider_detail
        JOIN "user" ON "user".provider_detail_id = provider_detail.provider_detail_id 
                    AND "user".deleted_at IS NULL 
                    AND "provider_detail".status = 'active'
        WHERE 
          (CASE WHEN $3 > 0 THEN consultation_price <= $3 ELSE consultation_price >= 0 END)
          AND
          (($4 = true AND consultation_price = 0) OR ($4 = false))
          AND
          (specializations::text[] && $5::text[])
        ORDER BY provider_detail.name ASC
      ), work_with_data AS (
        SELECT pwl.provider_detail_id, w.work_with_id, w.topic
        FROM provider_detail_work_with_links pwl
        JOIN "work_with" w ON pwl.work_with_id = w.work_with_id
        WHERE pwl.provider_detail_id IN (SELECT provider_detail_id FROM provider_filtered)
        ORDER BY pwl.created_at DESC
      ), language_data AS (
        SELECT pll.provider_detail_id, pll.language_id
        FROM provider_detail_language_links pll
        WHERE pll.provider_detail_id IN (SELECT provider_detail_id FROM provider_filtered)
        ORDER BY pll.created_at DESC
      ), 
      availability_data AS (
          SELECT DISTINCT ON (pa.provider_detail_id) 
                pa.provider_detail_id, 
                pa.start_date, 
                pa.slots,
                pa.campaign_slots, 
                pa.availability_id
          FROM availability pa
          WHERE pa.provider_detail_id IN (SELECT provider_detail_id FROM provider_filtered)
          AND ($6::int IS NULL OR (pa.start_date >= to_timestamp($6) AND slots IS NOT NULL))
          ORDER BY pa.provider_detail_id, pa.start_date ASC
    )
      SELECT 
        pf.*, 
        json_agg(DISTINCT jsonb_build_object('work_with_id', wd.work_with_id, 'topic', wd.topic)) AS work_with,
        json_agg(DISTINCT ld.language_id) AS languages,
        json_agg(DISTINCT jsonb_build_object('availability_id', av.availability_id, 'start_date', av.start_date, 'slots', av.slots)) AS availability
      FROM provider_filtered pf
      LEFT JOIN work_with_data wd ON pf.provider_detail_id = wd.provider_detail_id
      LEFT JOIN language_data ld ON pf.provider_detail_id = ld.provider_detail_id
      LEFT JOIN availability_data av ON pf.provider_detail_id = av.provider_detail_id
          WHERE ($6::int IS NULL OR availability_id IS NOT NULL)
      GROUP BY pf.provider_detail_id, pf.name, pf.patronym, pf.surname, pf.nickname, pf.email, pf.phone, pf.image, pf.specializations, pf.street, pf.city, pf.postcode, pf.education, pf.sex, pf.consultation_price, pf.description, pf.video_link, pf.status
      LIMIT $1
      OFFSET $2;
    `,
    [limit, offset, maxPrice, onlyFreeConsultation, providerTypes, startDate]
  );
};

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

      SELECT language_id, name, alpha2, local_name
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
          phone = $6,
          specializations = $7,
          street = $8,
          city = $9,
          postcode= $10,
          education= $11,
          sex= $12,
          consultation_price= $13,
          description= $14,
          video_link= $15
      WHERE provider_detail_id = $16
      RETURNING *;
    `,
    [
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
      SELECT client_detail_id, provider_detail_id, time, status, price, type, transaction_log.campaign_id , consultation.created_at
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
      SELECT campaign.* as campaigns_data, sponsor.name as sponsor_name, sponsor.phone, sponsor.image as sponsor_image, sponsor.email
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
  limit,
  offset,
  maxPrice,
  onlyFreeConsultation,
  providerTypes,
  startDate,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
    WITH provider_filtered AS (
      SELECT provider_detail."provider_detail_id", provider_detail."name", patronym, surname, 
             nickname, email, phone, image, specializations, street, city, postcode, 
             education, sex, consultation_price, description, video_link, 
             price_per_coupon, campaign.campaign_id
      FROM provider_detail
        JOIN "user" ON "user".provider_detail_id = provider_detail.provider_detail_id 
          AND "user".deleted_at IS NULL
        JOIN campaign ON campaign.campaign_id = $1
        JOIN provider_campaign_links ON provider_campaign_links.campaign_id = campaign.campaign_id 
          AND provider_campaign_links.provider_detail_id = provider_detail.provider_detail_id
      WHERE 
        (CASE WHEN $4 > 0 THEN consultation_price <= $4 ELSE consultation_price >= 0 END)
        AND
        ($5 = false OR ($5 = true AND consultation_price = 0))
        AND
        (specializations::text[] && $6::text[])
      ORDER BY provider_detail.name ASC
    ), work_with_data AS (
      SELECT pwl.provider_detail_id, w.work_with_id, w.topic
      FROM provider_detail_work_with_links pwl
      JOIN "work_with" w ON pwl.work_with_id = w.work_with_id
      WHERE pwl.provider_detail_id IN (SELECT provider_detail_id FROM provider_filtered)
      ORDER BY pwl.created_at DESC
    ), language_data AS (
      SELECT pll.provider_detail_id, pll.language_id
      FROM provider_detail_language_links pll
      WHERE pll.provider_detail_id IN (SELECT provider_detail_id FROM provider_filtered)
      ORDER BY pll.created_at DESC
    ), availability_data AS (
      SELECT DISTINCT ON (pa.provider_detail_id) 
        pa.provider_detail_id, 
        pa.start_date, 
        pa.slots, 
        pa.availability_id,
        pa.campaign_slots
      FROM availability pa
      WHERE pa.provider_detail_id IN (SELECT provider_detail_id FROM provider_filtered)
      AND ($7::int IS NULL OR (pa.start_date >= to_timestamp($7) AND slots IS NOT NULL))
      ORDER BY pa.provider_detail_id, pa.start_date ASC
    )
    SELECT 
      pf.*, 
      json_agg(DISTINCT jsonb_build_object('work_with_id', wd.work_with_id, 'topic', wd.topic)) AS work_with,
      json_agg(DISTINCT ld.language_id) AS languages,
      json_agg(DISTINCT jsonb_build_object(
        'availability_id', av.availability_id, 
        'start_date', av.start_date, 
        'slots', av.slots,
        'campaign_slots', av.campaign_slots
      )) AS availability
    FROM provider_filtered pf
    LEFT JOIN work_with_data wd ON pf.provider_detail_id = wd.provider_detail_id
    LEFT JOIN language_data ld ON pf.provider_detail_id = ld.provider_detail_id
    LEFT JOIN availability_data av ON pf.provider_detail_id = av.provider_detail_id
    WHERE ($7::int IS NULL OR av.availability_id IS NOT NULL)
    GROUP BY 
      pf.provider_detail_id, pf.name, pf.patronym, pf.surname, pf.nickname, 
      pf.email, pf.phone, pf.image, pf.specializations, pf.street, pf.city, 
      pf.postcode, pf.education, pf.sex, pf.consultation_price, pf.description, 
      pf.video_link, pf.price_per_coupon, pf.campaign_id
    LIMIT $2
    OFFSET $3;
    `,
    [
      campaignId,
      limit,
      offset,
      maxPrice,
      onlyFreeConsultation,
      providerTypes,
      startDate,
    ]
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

export const updateProviderStatusQuery = async ({
  poolCountry,
  providerDetailId,
  status,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
        UPDATE provider_detail
        SET status = $1
        WHERE provider_detail_id = $2
        RETURNING *;
      `,
    [status, providerDetailId]
  );
};

export const getProviderUserIdByDetailIdQuery = async ({
  poolCountry,
  providerDetailId,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
        SELECT user_id
        FROM "user"
        WHERE provider_detail_id = $1
      `,
    [providerDetailId]
  );
};

export const getProviderStatusQuery = async ({
  poolCountry,
  providerDetailId,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
        SELECT status
        FROM provider_detail
        WHERE provider_detail_id = $1
      `,
    [providerDetailId]
  );
};

export const getMultipleProvidersDataByIDs = async ({
  poolCountry,
  providerDetailIds,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        SELECT name, surname, patronym, email, provider_detail_id, image
        FROM provider_detail
        WHERE provider_detail_id = ANY($1);
      `,
    [providerDetailIds]
  );

export const addProviderRatingQuery = async ({
  poolCountry,
  providerDetailId,
  rating,
  comment,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        INSERT INTO provider_rating (provider_detail_id, rating, comment)
        VALUES ($1, $2, $3)
        RETURNING *;
      `,
    [providerDetailId, rating, comment]
  );

export const getActiveLanguagesQuery = async () => {
  return await getDBPool("masterDb").query(
    `
        SELECT language_id, name, alpha2, local_name
        FROM language
        WHERE is_active = true
        ORDER BY created_at DESC
      `
  );
};
