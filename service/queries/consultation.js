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

export const getAllConsultationsByProviderIdAndClientIdQuery = async ({
  poolCountry,
  providerId,
  clientId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      SELECT *
      FROM consultation
      WHERE provider_detail_id = $1 AND client_detail_id = $2 AND (status = 'scheduled' OR status = 'finished')
      ORDER BY time DESC;

    `,
    [providerId, clientId]
  );

export const addConsultationAsPendingQuery = async ({
  poolCountry,
  clientId,
  providerId,
  time,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      INSERT INTO consultation (client_detail_id, provider_detail_id, time, status)
      VALUES ($1, $2, to_timestamp($3), 'pending')
      RETURNING *;

    `,
    [clientId, providerId, time]
  );

export const addConsultationAsScheduledQuery = async ({
  poolCountry,
  client_id,
  provider_id,
  time,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
      WITH chatData AS (

        INSERT INTO chat (client_detail_id, provider_detail_id, date)
        VALUES ($1, $2, to_timestamp($3))
        RETURNING chat_id
      )

      INSERT INTO consultation (client_detail_id, provider_detail_id, chat_id, time, status)
      VALUES ($1, $2, (SELECT chat_id FROM chatData), to_timestamp($3), 'scheduled');

    `,
    [client_id, provider_id, time]
  );

export const getConsultationByIdQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      SELECT * 
      FROM consultation
      WHERE consultation_id = $1
      ORDER BY created_at DESC
      LIMIT 1;

    `,
    [consultationId]
  );

export const updateConsultationStatusAsScheduledQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
      WITH chatData AS (

        INSERT INTO chat (client_detail_id, provider_detail_id, date)
          SELECT client_detail_id, provider_detail_id, time
          FROM consultation
          WHERE consultation_id = $1
        RETURNING chat_id
      )

      UPDATE consultation
      SET status = 'scheduled', chat_id = (SELECT chat_id FROM chatData)
      WHERE consultation_id = $1;

    `,
    [consultationId]
  );

export const rescheduleConsultationQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
  
        UPDATE consultation
        SET status = 'rescheduled'
        WHERE consultation_id = $1
        RETURNING *;
  
      `,
    [consultationId]
  );

export const cancelConsultationQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      UPDATE consultation
      SET status = 'canceled'
      WHERE consultation_id = $1
      RETURNING *;

    `,
    [consultationId]
  );

export const getConsultationsForDayQuery = async ({
  poolCountry,
  providerId,
  previousDayTimestamp,
  nextDayTimestamp,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      SELECT * 
      FROM consultation
      WHERE provider_detail_id = $1 AND time >= to_timestamp($2) AND time < to_timestamp($3) AND (status = 'pending' OR status = 'suggested' OR status = 'scheduled' OR status = 'finished')
      ORDER BY time DESC;

    `,
    [providerId, previousDayTimestamp, nextDayTimestamp]
  );

export const getAllConsultationsByProviderIdQuery = async ({
  poolCountry,
  providerId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT * 
      FROM consultation
      WHERE provider_detail_id = $1 AND (status = 'scheduled' OR status = 'finished')
      ORDER BY time DESC;
    `,
    [providerId]
  );

export const getAllConsultationsCountQuery = async ({
  poolCountry,
  providerId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT COUNT(*) 
      FROM consultation
      WHERE provider_detail_id = $1 AND (status = 'scheduled' OR status = 'finished') AND time < now();
    `,
    [providerId]
  );
