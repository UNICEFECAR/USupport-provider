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
