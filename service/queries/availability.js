import { getDBPool } from "#utils/dbConfig";

export const getUpcomingAvailabilityByProviderIdQuery = async ({
  poolCountry,
  providerId,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT *
      FROM availability
      WHERE provider_detail_id = $1 AND start_date > now() - interval '7 days'
      ORDER BY start_date ASC;
    `,
    [providerId]
  );

export const getAvailabilitySingleWeekQuery = async ({
  poolCountry,
  provider_id,
  startDate,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT slots, campaign_slots
      FROM availability
      WHERE availability.provider_detail_id = $1 AND availability.start_date = to_timestamp($2)
      ORDER BY availability.created_at DESC
    `,
    [provider_id, startDate]
  );

export const addAvailabilityRowQuery = async ({
  poolCountry,
  provider_id,
  startDate,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `

      INSERT INTO availability (provider_detail_id, start_date)
      VALUES ($1, to_timestamp($2));

    `,
    [provider_id, startDate]
  );

export const updateAvailabilitySingleSlotQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
  campaignId,
}) => {
  if (!campaignId) {
    return await getDBPool("piiDb", poolCountry).query(
      `

      UPDATE availability
      SET slots = (SELECT array_agg(distinct e) FROM UNNEST(slots || to_timestamp($3)) e)
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

    `,
      [provider_id, startDate, slot]
    );
  } else {
    return await getDBPool("piiDb", poolCountry).query(
      `
        UPDATE availability
        SET campaign_slots = (SELECT array_agg(distinct e) FROM UNNEST(campaign_slots::jsonb[] || ARRAY[jsonb_build_object('campaignId', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ'))]) e)
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
      `,
      [provider_id, startDate, slot, campaignId]
    );
  }
};

export const updateAvailabilityMultipleSlotsQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slots,
  campaignId,
}) => {
  if (!campaignId) {
    return await getDBPool("piiDb", poolCountry).query(
      `

        UPDATE availability
        SET slots = (SELECT array_agg(distinct e) FROM UNNEST(slots || $3::timestamptz[]) e)
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

      `,
      [provider_id, startDate, slots]
    );
  }

  return await getDBPool("piiDb", poolCountry).query(
    `
    WITH data AS (
      SELECT unnest($3::text[]) AS value
    ), new_campaign_slots AS (
      SELECT jsonb_build_object(
        'campaign_id', $4::uuid,
        'time', to_char(to_timestamp(value, 'YYYY-MM-DD"T"HH24:MI:SS'), 'YYYY-MM-DD HH24:MI:SS TZ')
      ) AS campaign_slot
      FROM data
    )
    UPDATE availability
    SET campaign_slots  = campaign_slots::jsonb[] || (
        SELECT jsonb_agg(e)
        FROM UNNEST(ARRAY(SELECT * FROM new_campaign_slots)) e
    )
    WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
    `,
    [provider_id, startDate, slots, campaignId]
  );
};
// WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
// 'time', to_char(to_timestamp(value, 'YYYY-MM-DDTHH:MI:SS'), 'YYYY-MM-DD HH24:MI:SS TZ')

export const deleteAvailabilitySingleWeekQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
  campaignId,
}) => {
  if (!campaignId) {
    return await getDBPool("piiDb", poolCountry).query(
      `
      UPDATE availability
      SET slots = array_remove(slots, to_timestamp($3))
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

    `,
      [provider_id, startDate, slot]
    );
  } else {
    return await getDBPool("piiDb", poolCountry).query(
      `
      UPDATE availability
      SET campaign_slots = array_remove(campaign_slots::jsonb[], jsonb_build_object('campaignId', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ')))
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

    `,
      [provider_id, startDate, slot, campaignId]
    );
  }
};
