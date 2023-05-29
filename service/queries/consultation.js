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

      SELECT consultation.client_detail_id, consultation.consultation_id, chat_id, time, status, price, transaction_log.campaign_id
      FROM consultation
        LEFT JOIN transaction_log ON transaction_log.consultation_id = consultation.consultation_id
      WHERE provider_detail_id = $1 AND client_detail_id = $2 AND (status = 'scheduled' OR status = 'finished')
      ORDER BY time DESC;

    `,
    [providerId, clientId]
  );

export const updateStatusOfAllPendingConsultationsToTimeoutQuery = async ({
  poolCountry,
  minToTimeout,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
        UPDATE consultation
        SET status = 'timeout'
        WHERE status = 'pending' AND created_at < (NOW() - $1 * INTERVAL '1 MINUTE');
      `,
    [minToTimeout]
  );

export const addConsultationAsPendingQuery = async ({
  poolCountry,
  clientId,
  providerId,
  time,
  price,
  campaignId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      INSERT INTO consultation (client_detail_id, provider_detail_id, time, status, price, campaign_id)
      VALUES ($1, $2, to_timestamp($3), 'pending', $4, $5)
      RETURNING *;

    `,
    [clientId, providerId, time, price, campaignId]
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

export const addConsultationAsSuggestedQuery = async ({
  poolCountry,
  client_id,
  provider_id,
  time,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      INSERT INTO consultation (client_detail_id, provider_detail_id, time, status)
      VALUES ($1, $2, to_timestamp($3), 'suggested');
      RETURNING *;
  
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
      WHERE consultation_id = $1
      RETURNING *;
    `,
    [consultationId]
  );

export const updateConsultationStatusAsSuggestedQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      UPDATE consultation
      SET status = 'suggested'
      WHERE consultation_id = $1;
  
    `,
    [consultationId]
  );

export const updateConsultationStatusAsRejectedQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      UPDATE consultation
      SET status = 'rejected'
      WHERE consultation_id = $1
      RETURNING *;

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

export const joinConsultationClientQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      UPDATE consultation
      SET client_join_time = now()
      WHERE consultation_id = $1 AND client_join_time IS NULL;

    `,
    [consultationId]
  );

export const joinConsultationProviderQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
  
      UPDATE consultation
      SET provider_join_time = now()
      WHERE consultation_id = $1 AND provider_join_time IS NULL;

    `,
    [consultationId]
  );

export const leaveConsultationClientQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
  
      UPDATE consultation
      SET client_leave_time = now()
      WHERE consultation_id = $1
      RETURNING *;

    `,
    [consultationId]
  );

export const leaveConsultationProviderQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
    
      UPDATE consultation
      SET provider_leave_time = now()
      WHERE consultation_id = $1
      RETURNING *;

    `,
    [consultationId]
  );

export const updateConsultationStatusAsFinishedQuery = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      UPDATE consultation
      SET status = 'finished'
      WHERE consultation_id = $1

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
      SELECT consultation.client_detail_id, consultation.consultation_id, chat_id, time, status, price, transaction_log.campaign_id
      FROM consultation
        LEFT JOIN transaction_log on transaction_log.consultation_id = consultation.consultation_id
      WHERE provider_detail_id = $1 AND (status = 'suggested' OR status = 'scheduled' OR status = 'finished')
      ORDER BY time DESC;
    `,
    [providerId]
  );

export const getAllUpcomingConsultationsByProviderIdQuery = async ({
  poolCountry,
  providerId,
  pageNo,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT consultation.client_detail_id, consultation.consultation_id, chat_id, time, status, price, transaction_log.campaign_id, COUNT(*) OVER() AS total_count
      FROM consultation
        LEFT JOIN transaction_log on transaction_log.consultation_id = consultation.consultation_id
      WHERE provider_detail_id = $1 AND time >= now() + interval '1 hour' AND (status = 'suggested' OR status = 'scheduled' OR status = 'finished')
      ORDER BY time ASC
      LIMIT 6
      OFFSET $2;
    `,
    [providerId, (pageNo - 1) * 6]
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

export const getUpcomingConsultationsByProviderIdQuery = async ({
  poolCountry,
  providerId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
  
        SELECT * 
        FROM consultation
        WHERE provider_detail_id = $1 AND time >= now() AND (status = 'pending' OR status = 'suggested' OR status = 'scheduled' OR status = 'finished')
        ORDER BY time ASC;
  
      `,
    [providerId]
  );

export const getConsultationsSingleWeekQuery = async ({
  poolCountry,
  providerId,
  startDate,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT consultation.client_detail_id, consultation.consultation_id, chat_id, time, status, price, transaction_log.campaign_id
      FROM consultation
        LEFT JOIN transaction_log on transaction_log.consultation_id = consultation.consultation_id
      WHERE provider_detail_id = $1 AND time >= to_timestamp($2) AND time < to_timestamp($2) + interval '7 days' AND (status = 'suggested' OR status = 'scheduled' OR status = 'finished')
      ORDER BY time ASC;
    `,
    [providerId, startDate]
  );

export const getConsultationsSingleDayQuery = async ({
  poolCountry,
  providerId,
  date,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
    
        SELECT consultation.client_detail_id, consultation.consultation_id, chat_id, time, status, price, transaction_log.campaign_id
        FROM consultation
          LEFT JOIN transaction_log on transaction_log.consultation_id = consultation.consultation_id
        WHERE provider_detail_id = $1 AND time >= to_timestamp($2) AND time < to_timestamp($2) + interval '1 day' AND (status = 'suggested' OR status = 'scheduled' OR status = 'finished')
        ORDER BY time ASC;
  
      `,
    [providerId, date]
  );

export const getFutureConsultationsCountQuery = async ({
  poolCountry,
  providerId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `

      SELECT COUNT(*) 
      FROM consultation
      WHERE provider_detail_id = $1 AND time >= now() AND (status = 'pending' OR status = 'suggested' OR status = 'scheduled');

    `,
    [providerId]
  );

export const getConsultationTimeQuerry = async ({
  poolCountry,
  consultationId,
}) =>
  await getDBPool("clinicalDb", poolCountry).query(
    `
        SELECT time
        FROM consultation
        WHERE consultation_id = $1
      `,
    [consultationId]
  );

export const getProviderConsultationsForCampaign = async ({
  poolCountry,
  providerId,
  campaignId,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
          SELECT consultation.consultation_id, consultation.provider_detail_id, consultation.price, consultation.client_detail_id, chat_id, status, time
          FROM consultation
            LEFT JOIN transaction_log on transaction_log.consultation_id = consultation.consultation_id AND transaction_log.campaign_id = $2
            WHERE provider_detail_id = $1 AND transaction_log.consultation_id = consultation.consultation_id AND (status = 'finished' OR status = 'scheduled')
          GROUP BY consultation.consultation_id
        `,
    [providerId, campaignId]
  );
};

export const getClientConsultationsForSpecificTime = async ({
  poolCountry,
  clientId,
  time,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
        SELECT *
        FROM consultation
        WHERE client_detail_id = $1 AND time = to_timestamp($2) AND status = 'scheduled'
      `,
    [clientId, time]
  );
};
