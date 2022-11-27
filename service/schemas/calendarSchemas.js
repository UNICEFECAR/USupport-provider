import * as yup from "yup";

export const getCalendarFiveWeeksSchema = yup.object().shape({
  providerId: yup.string().uuid().required(),
  country: yup.string().required(),
  startDate: yup.string().required(),
});
