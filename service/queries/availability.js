import { getDBPool } from "#utils/dbConfig";

export const getAvailabilitySingleWeekQuery = async ({
  poolCountry,
  provider_id,
  startDate,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `

      SELECT slots 
      FROM availability
      WHERE provider_detail_id = $1 AND start_date = to_timestamp($2)
      ORDER BY created_at DESC
      LIMIT 1;

    `,
    [provider_id, startDate]
  );

export const addAvailabilitySingleWeekQuery = async ({
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

export const updateAvailabilitySingleWeekQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `

        UPDATE availability
        SET slots = (SELECT array_agg(distinct e) FROM UNNEST(slots || to_timestamp($3)) e)
        WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

      `,
    [provider_id, startDate, slot]
  );

export const deleteAvailabilitySingleWeekQuery = async ({
  poolCountry,
  provider_id,
  startDate,
  slot,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `

          UPDATE availability
          SET slots = array_remove(slots, to_timestamp($3))
          WHERE provider_detail_id = $1 AND start_date = to_timestamp($2);

        `,
    [provider_id, startDate, slot]
  );
