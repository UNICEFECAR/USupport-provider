import {
  getAllServicesQuery,
  getServiceByIdQuery,
  addServicesAfterConsultationQuery,
} from "#queries/services";

import { getConsultationByIdQuery } from "#queries/consultation";

import {
  consultationNotFound,
  consultationNotFinished,
  serviceNotFound,
} from "#utils/errors";

export const getAllServices = async () => {
  return await getAllServicesQuery()
    .then((res) => {
      return res.rows;
    })
    .catch((err) => {
      throw err;
    });
};

export const addServicesAfterConsultation = async ({
  country,
  language,
  consultationId,
  services,
}) => {
  // Check if the consultation is in the right status
  const consultation = await getConsultationByIdQuery({
    poolCountry: country,
    consultationId,
  })
    .then(async (raw) => {
      if (raw.rowCount === 0) {
        throw consultationNotFound(language);
      }

      return raw.rows[0];
    })
    .catch((err) => {
      throw err;
    });

  if (consultation.status !== "finished") {
    throw consultationNotFinished(language);
  }

  // Add the services to the consultation
  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    const serviceId = service.serviceId;

    await getServiceByIdQuery({
      serviceId,
    })
      .then(async (raw) => {
        if (raw.rowCount === 0) {
          throw serviceNotFound(language);
        }
      })
      .catch((err) => {
        throw err;
      });

    await addServicesAfterConsultationQuery({
      clientId: consultation.client_detail_id,
      providerId: consultation.provider_detail_id,
      serviceId,
      duration: service.duration,
    }).catch((err) => {
      throw err;
    });
  }

  return { success: true };
};
