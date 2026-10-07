import { getDBPool } from "#utils/dbConfig";
import { DEFAULT_SLOT_MINUTES } from "#utils/slotDuration";

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
    [providerId],
  );

export const getAvailabilitySingleWeekQuery = async ({
  poolCountry,
  provider_id,
  startDate,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT slots, campaign_slots, organization_slots, COALESCE(slot_durations, '{}'::jsonb) AS slot_durations
      FROM availability
      WHERE availability.provider_detail_id = $1 AND availability.start_date = to_timestamp($2)
      ORDER BY availability.created_at DESC
    `,
    [provider_id, startDate],
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
    [provider_id, startDate],
  );

/**
 * Open one slot, in whichever pool the caller names, and record how long it is.
 *
 * The duration lands in the shared `slot_durations` map in the SAME statement as
 * the slot itself - split across two statements, a crash in between leaves a
 * slot with no duration key, which silently reads back as 60 minutes.
 */
export const updateAvailabilitySingleSlotQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
  campaignId,
  organizationId,
  durationMinutes = DEFAULT_SLOT_MINUTES,
}) => {
  // Shared by the campaign/organization branches: $5 is the slot, $6 its length.
  const setSlotDuration = `slot_durations = COALESCE(slot_durations, '{}'::jsonb) || jsonb_build_object($5::bigint::text, to_jsonb($6::int))`;

  if (organizationId) {
    return await getDBPool("piiDb", poolCountry).query(
      `
      WITH slots AS (
        SELECT jsonb_agg(jsonb_build_object('organization_id', $4::uuid, 'time', to_char(to_timestamp($3), 'YYYY-MM-DD HH24:MI:SS TZ'))) as s
        FROM availability
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2)
      )
      UPDATE availability
      SET organization_slots = COALESCE(organization_slots, '[]'::jsonb) || (SELECT s FROM slots),
          ${setSlotDuration}
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
  
      `,
      [provider_id, startDate, slot, organizationId, slot, durationMinutes],
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
      SET campaign_slots = COALESCE(campaign_slots, '[]'::jsonb) || (SELECT s FROM slots),
          ${setSlotDuration}
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
  
      `,
      [provider_id, startDate, slot, campaignId, slot, durationMinutes],
    );
  } else {
    return await getDBPool("piiDb", poolCountry).query(
      `

      UPDATE availability
      SET slots = (SELECT array_agg(distinct e) FROM UNNEST(slots || to_timestamp($3)) e),
          slot_durations = COALESCE(slot_durations, '{}'::jsonb) || jsonb_build_object($4::bigint::text, to_jsonb($5::int))
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

    `,
      [provider_id, startDate, slot, slot, durationMinutes],
    );
  }
};

export const updateAvailabilityMultipleSlotsQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slots,
  campaignId,
  durationMinutes = DEFAULT_SLOT_MINUTES,
  slotSeconds = [],
}) => {
  // `slotSeconds` are the same slots as unix seconds - the duration map is keyed
  // by instant, and `slots` arrives as timestamp text for the array column.
  const setSlotDurations = `slot_durations = COALESCE(slot_durations, '{}'::jsonb) || (
          SELECT COALESCE(jsonb_object_agg(s::bigint::text, to_jsonb($DUR::int)), '{}'::jsonb)
          FROM unnest($SEC::bigint[]) AS s
        )`;

  if (!campaignId) {
    return await getDBPool("piiDb", poolCountry).query(
      `

        UPDATE availability
        SET slots = (SELECT array_agg(distinct e) FROM UNNEST(slots || $3::timestamptz[]) e),
            ${setSlotDurations.replace("$DUR", "$4").replace("$SEC", "$5")}
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

      `,
      [provider_id, startDate, slots, durationMinutes, slotSeconds],
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
    ),
        ${setSlotDurations.replace("$DUR", "$5").replace("$SEC", "$6")}
    WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
    `,
    [provider_id, startDate, slots, campaignId, durationMinutes, slotSeconds],
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
      [provider_id, startDate, slot, campaignId],
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
      [provider_id, startDate, slot, organizationId],
    );
  } else {
    return await getDBPool("piiDb", poolCountry).query(
      `
      UPDATE availability
      SET slots = array_remove(slots, to_timestamp($3))
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);
      `,
      [provider_id, startDate, slot],
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
    [provider_id, startDate, slot],
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
    [provider_id, startDate, slot],
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
    [providerDetailId, organizationId],
  );
};

/**
 * Change how long an already-open slot is.
 *
 * Duration is a property of the instant, shared by the normal / campaign /
 * organization pools, so this is one write regardless of which pool(s) the
 * provider opened the slot in.
 */
export const updateSlotDurationQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
  durationMinutes,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      UPDATE availability
      SET slot_durations = COALESCE(slot_durations, '{}'::jsonb)
                           || jsonb_build_object($3::bigint::text, to_jsonb($4::int))
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2)
      RETURNING slot_durations;
    `,
    [provider_id, startDate, slot, durationMinutes],
  );

/**
 * Clear every slot at the given instants, across all three pools, plus their
 * duration keys - in one statement.
 *
 * The template's "this day is unavailable" path used to fire one request per
 * slot; on a 30-minute grid that is 48 round trips per day.
 *
 * This is the only place duration keys are removed. Single-pool deletes leave
 * them behind on purpose: the same instant may still be open in another pool,
 * and a key nothing points at is a no-op on read.
 */
export const clearAvailabilitySlotsBulkQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slotSeconds,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      WITH targets AS (
        SELECT to_timestamp(s) AS ts, s::bigint::text AS key
        FROM unnest($3::bigint[]) AS s
      )
      UPDATE availability a
      SET slots = COALESCE(
            (
              SELECT array_agg(e)
              FROM unnest(COALESCE(a.slots, ARRAY[]::timestamptz[])) e
              WHERE e NOT IN (SELECT ts FROM targets)
            ),
            ARRAY[]::timestamptz[]
          ),
          campaign_slots = COALESCE(
            (
              SELECT jsonb_agg(e)
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(a.campaign_slots) = 'array' THEN a.campaign_slots ELSE '[]'::jsonb END
              ) e
              WHERE (e->>'time')::timestamptz NOT IN (SELECT ts FROM targets)
            ),
            '[]'::jsonb
          ),
          organization_slots = COALESCE(
            (
              SELECT jsonb_agg(e)
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(a.organization_slots) = 'array' THEN a.organization_slots ELSE '[]'::jsonb END
              ) e
              WHERE (e->>'time')::timestamptz NOT IN (SELECT ts FROM targets)
            ),
            '[]'::jsonb
          ),
          slot_durations = COALESCE(a.slot_durations, '{}'::jsonb)
                           - ARRAY(SELECT key FROM targets)
      WHERE a.provider_detail_id = $1 AND a.start_date = to_timestamp($2);
    `,
    [provider_id, startDate, slotSeconds],
  );
