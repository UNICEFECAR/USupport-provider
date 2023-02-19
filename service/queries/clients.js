import { getDBPool } from "#utils/dbConfig";

export const getClientByIdQuery = async ({ poolCountry, clientId }) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT client_detail."client_detail_id", "name", surname, nickname, email, image, sex, year_of_birth, urban_rural, data_processing, access_token
      FROM client_detail
        JOIN "user" ON "user".client_detail_id = client_detail.client_detail_id AND "user".deleted_at IS NULL
      WHERE client_detail.client_detail_id = $1
      ORDER BY client_detail.created_at DESC
      LIMIT 1;
    `,
    [clientId]
  );

export const getClientEmailAndUserIdQuery = async ({ poolCountry, clientId }) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT "user".user_id, email, push_notification_tokens
      FROM "user"
        JOIN client_detail ON "user".client_detail_id = client_detail.client_detail_id
      WHERE client_detail.client_detail_id = $1
      LIMIT 1;
      `,
    [clientId]
  );

export const getMultipleClientsDataByIDs = async ({
  poolCountry,
  clientDetailIds,
}) =>
  await getDBPool("piiDb", poolCountry).query(
    `
      SELECT name, surname, nickname, email, client_detail_id
      FROM client_detail
      WHERE client_detail_id = ANY($1);
    `,
    [clientDetailIds]
  );
