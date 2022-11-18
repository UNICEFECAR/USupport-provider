import { getDBPool } from "#utils/dbConfig";

export const getConsultationByTimeAndProviderIdQuery = async ({
  poolCountry,
  providerId,
  time,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      SELECT * 
      FROM consultation
      WHERE provider_detail_id = $1 AND time = to_timestamp($2) AND (status = 'pending' OR status = 'suggested' OR status = 'scheduled' OR status = 'finished')
      ORDER BY created_at DESC
      LIMIT 1;

    `,
    [providerId, time]
  );

export const addConsultationAsPendingQuery = async ({
  poolCountry,
  client_id,
  providerId,
  time,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      INSERT INTO consultation (client_detail_id, provider_detail_id, time, status)
      VALUES ($1, $2, to_timestamp($3), 'pending');
      RETURNING *;
    `,
    [client_id, providerId, time]
  );

export const addConsultationAsScheduledQuery = async ({
  poolCountry,
  client_id,
  provider_id,
  time,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
    
          INSERT INTO consultation (client_detail_id, provider_detail_id, time, status)
          VALUES ($1, $2, to_timestamp($3), 'scheduled');
    
        `,
    [client_id, provider_id, time]
  );

export const getConsultationByIdAndClientIdQuery = async ({
  poolCountry,
  client_id,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

        SELECT * 
        FROM consultation
        WHERE client_detail_id = $1 AND consultation_id = $2
        ORDER BY created_at DESC
        LIMIT 1;

      `,
    [client_id, consultationId]
  );

export const updateConsultationStatusAsScheduledQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

        UPDATE consultation
        SET status = 'scheduled'
        WHERE consultation_id = $1;

      `,
    [consultationId]
  );
