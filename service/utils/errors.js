import { t } from "#translations/index";

export const incorrectPassword = (language) => {
  const error = new Error();
  error.message = t("incorrect_password_error", language);
  error.name = "INCORRECT PASSWORD";
  error.status = 404;
  return error;
};

export const emailUsed = (language) => {
  const error = new Error();
  error.message = t("email_already_used_error", language);
  error.name = "EMAIL ALREADY USED";
  error.status = 409;
  return error;
};

export const providerNotFound = (language) => {
  const error = new Error();
  error.message = t("provider_not_found_error", language);
  error.name = "PROVIDER NOT FOUND";
  error.status = 404;
  return error;
};

export const clientNotFound = (language) => {
  const error = new Error();
  error.message = t("client_not_found_error", language);
  error.name = "CLIENT NOT FOUND";
  error.status = 404;
  return error;
};

export const slotsNotWithinWeek = (language) => {
  const error = new Error();
  error.message = t("slots_not_within_week_error", language);
  error.name = "SLOTS NOT WITHIN WEEK";
  error.status = 400;
  return error;
};

export const slotNotAvailable = (language) => {
  const error = new Error();
  error.message = t("slot_not_available_error", language);
  error.name = "SLOT IS NOT AVAILABLE";
  error.status = 400;
  return error;
};

export const consultationNotFound = (language) => {
  const error = new Error();
  error.message = t("consultation_not_found_error", language);
  error.name = "CONSULTATION NOT FOUND";
  error.status = 404;
  return error;
};
