import { getDBPool } from "#utils/dbConfig";

export const getUserByID = async (poolCountry, user_id) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        SELECT user_id, country_id, type, client_detail_id, provider_detail_id, notification_preference_id, password
        FROM "user"
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1;
        
    `,
    [user_id]
  );

export const getUserByProviderID = async (poolCountry, provider_id) =>
  await getDBPool("piiDb", poolCountry).query(
    `
        SELECT user_id, country_id, type, client_detail_id, provider_detail_id, notification_preference_id, password
        FROM "user"
        WHERE provider_detail_id = $1
        ORDER BY created_at DESC
        LIMIT 1;
        
    `,
    [provider_id]
  );

export const getUserIdsByProviderIdsQuery = async ({ country, providerIds }) =>
  await getDBPool("piiDb", country).query(
    `
        SELECT user_id, provider_detail_id
        FROM "user"
        WHERE provider_detail_id = ANY($1);
      `,
    [providerIds]
  );

export const getCountryDetailsByAlpha2Query = async (alpha2) =>
  await getDBPool("masterDb").query(
    `
        SELECT *
        FROM "country"
        WHERE alpha2 = $1;
      `,
    [alpha2]
  );
