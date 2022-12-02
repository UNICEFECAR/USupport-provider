import { getDBPool } from "#utils/dbConfig";

export const getAllServicesQuery = async () =>
  await getDBPool("masterDb").query(
    `
      SELECT service_id, type
      FROM service;
    `
  );

export const getServiceByIdQuery = async ({ serviceId }) =>
  await getDBPool("masterDb").query(
    `
      SELECT service_id, type
      FROM service
      WHERE service_id = $1
      LIMIT 1;
    `,
    [serviceId]
  );

export const addServicesAfterConsultationQuery = async ({
  clientId,
  providerId,
  serviceId,
  duration,
}) =>
  await getDBPool("masterDb").query(
    `
  
      INSERT INTO service_client_provider_links (client_detail_id, provider_detail_id, service_id, duration)
      VALUES ($1, $2, $3, $4)
      RETURNING *;

    `,
    [clientId, providerId, serviceId, duration]
  );
