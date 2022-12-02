import * as yup from "yup";

export const addServicesAfterConsultationSchema = yup.object().shape({
  country: yup.string().required(),
  language: yup.string().required(),
  consultationId: yup.string().uuid().required(),
  services: yup.array().of(
    yup.object().shape({
      serviceId: yup.string().uuid().required(),
      duration: yup.number().required(),
    })
  ),
});
