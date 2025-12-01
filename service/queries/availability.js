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
      SELECT slots, campaign_slots, organization_slots
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
  organizationId,
}) => {
  if (organizationId) {
    return await getDBPool("piiDb", poolCountry).query(
      `
      WITH slots AS (
        SELECT jsonb_agg(jsonb_build_object('organization_id', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ'))) as s
        FROM availability
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2)
      )
      UPDATE availability
      SET organization_slots = COALESCE(organization_slots, '[]'::jsonb) || (SELECT s FROM slots)
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
  
      `,
      [provider_id, startDate, slot, organizationId]
    );
  } else if (campaignId) {
    return await getDBPool("piiDb", poolCountry).query(
      `
      WITH slots AS (
        SELECT jsonb_agg(jsonb_build_object('campaign_id', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ'))) as s
        FROM availability
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2)
      )
      UPDATE availability
      SET campaign_slots = COALESCE(campaign_slots, '[]'::jsonb) || (SELECT s FROM slots)
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
  
      `,
      [provider_id, startDate, slot, campaignId]
    );
  } else {
    return await getDBPool("piiDb", poolCountry).query(
      `

      UPDATE availability
      SET slots = (SELECT array_agg(distinct e) FROM UNNEST(slots || to_timestamp($3)) e)
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

    `,
      [provider_id, startDate, slot]
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
        SET campaign_slots  = campaign_slots || (
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
  organizationId,
}) => {
  if (campaignId) {
    return await getDBPool("piiDb", poolCountry).query(
      `
      UPDATE availability a
      SET campaign_slots = (
        SELECT jsonb_agg(e)
          FILTER (WHERE e != jsonb_build_object('campaign_id', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ')))
        FROM jsonb_array_elements(campaign_slots) e
      )
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

      `,
      [provider_id, startDate, slot, campaignId]
    );
  } else if (organizationId) {
    return await getDBPool("piiDb", poolCountry).query(
      `
      UPDATE availability a
      SET organization_slots = (
        SELECT jsonb_agg(e)
          FILTER (WHERE e != jsonb_build_object('organization_id', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ')))
        FROM jsonb_array_elements(organization_slots) e
      )
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

      `,
      [provider_id, startDate, slot, organizationId]
    );
  } else {
    return await getDBPool("piiDb", poolCountry).query(
      `
      UPDATE availability
      SET slots = array_remove(slots, to_timestamp($3))
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
      `,
      [provider_id, startDate, slot]
    );
  }
};

/**
 * Delete a slot from ALL campaign_slots for the given provider/week,
 * regardless of campaign_id (used when marking a day fully unavailable
 * without specifying particular campaigns).
 */
export const deleteAvailabilitySingleWeekAllCampaignsQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
    UPDATE availability a
    SET campaign_slots = (
      SELECT jsonb_agg(e)
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(campaign_slots) = 'array'
          THEN campaign_slots
          ELSE '[]'::jsonb
        END
      ) e
      WHERE e->>'time' != to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ')
    )
    WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
    `,
    [provider_id, startDate, slot]
  );

/**
 * Delete a slot from ALL organization_slots for the given provider/week,
 * regardless of organization_id (used when marking a day fully unavailable
 * without specifying particular organizations).
 */
export const deleteAvailabilitySingleWeekAllOrganizationsQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
    UPDATE availability a
    SET organization_slots = (
      SELECT jsonb_agg(e)
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(organization_slots) = 'array'
          THEN organization_slots
          ELSE '[]'::jsonb
        END
      ) e
      WHERE e->>'time' != to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ')
    )
    WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
    `,
    [provider_id, startDate, slot]
  );

export const checkProviderFutureOrganizationSlotsQuery = async ({
  providerDetailId,
  organizationId,
  poolCountry,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
      SELECT COUNT(*) AS count
      FROM availability a
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(a.organization_slots) = 'array'
          THEN a.organization_slots
          ELSE '[]'::jsonb
        END
      ) e
      WHERE a.provider_detail_id = $1
        AND (e->>'organization_id')::uuid = $2
        AND (e->>'time')::timestamptz > NOW();
    `,
    [providerDetailId, organizationId]
  );
};
