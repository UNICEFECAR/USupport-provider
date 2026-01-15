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

export const userNotFound = (language) => {
  const error = new Error();
  error.message = t("user_not_found_error", language);
  error.name = "USER NOT FOUND";
  error.status = 404;
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

export const expiredCampaign = (language) => {
  const error = new Error();
  error.message = t("expired_campaign_error", language);
  error.name = "EXPIRED CAMPAIGN";
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

export const providerHasFutureConsultations = (language) => {
  const error = new Error();
  error.message = t("provider_has_future_consultations_error", language);
  error.name = "PROVIDER HAS FUTURE CONSULTATIONS";
  error.status = 400;
  return error;
};

export const consultationNotScheduled = (language) => {
  const error = new Error();
  error.message = t("consultation_not_scheduled_error", language);
  error.name = "CONSULTATION NOT SCHEDULED";
  error.status = 400;
  return error;
};

export const consultationNotFinished = (language) => {
  const error = new Error();
  error.message = t("consultation_not_finished_error", language);
  error.name = "CONSULTATION NOT FINISHED";
  error.status = 400;
  return error;
};

export const serviceNotFound = (language) => {
  const error = new Error();
  error.message = t("service_not_found_error", language);
  error.name = "SERVICE NOT FOUND";
  error.status = 404;
  return error;
};

export const transactionNotFound = (language) => {
  const error = new Error();
  error.message = t("transaction_not_found_error", language);
  error.name = "TRANSACTION NOT FOUND";
  error.status = 404;
  return error;
};

export const campaignNotFound = (language) => {
  const error = new Error();
  error.message = t("campaign_not_found_error", language);
  error.name = "CAMPAIGN NOT FOUND";
  error.status = 404;
  return error;
};

export const slotAlreadyExists = (language) => {
  const error = new Error();
  error.message = t("slot_already_exists_error", language);
  error.name = "SLOT ALREADY EXISTS";
  error.status = 400;
  return error;
};

export const providerInactive = (language) => {
  const error = new Error();
  error.message = t("provider_inactive_error", language);
  error.name = "PROVIDER INACTIVE";
  error.status = 400;
  return error;
};

export const questionCantBeArchived = (language) => {
  const error = new Error();
  error.message = t("question_cant_be_archived_error", language);
  error.name = "QUESTION CANT BE ARCHIVED";
  error.status = 400;
  return error;
};

export const bookingNotAllowed = (language) => {
  const error = new Error();
  error.message = t("booking_not_allowed_error", language);
  error.name = "BOOKING NOT ALLOWED";
  error.status = 400;
  return error;
};

export const clientCantBook = (language) => {
  const error = new Error();
  error.message = t("client_cant_book_error", language);
  error.name = "CLIENT CANT BOOK";
  error.status = 400;
  return error;
};

export const campaignOrOrganizationRequired = (language) => {
  const error = new Error();
  error.message = t("campaign_or_organization_required_error", language);
  error.name = "CAMPAIGN OR ORGANIZATION REQUIRED";
  error.status = 400;
  return error;
};

export const countryNotFound = (language) => {
  const error = new Error();
  error.message = t("country_not_found_error", language);
  error.name = "COUNTRY NOT FOUND";
  error.status = 404;
  return error;
};

export const consultationAlreadyStarted = (language) => {
  const error = new Error();
  error.message = t("consultation_already_started_error", language);
  error.name = "CONSULTATION ALREADY STARTED";
  error.status = 400;
  return error;
};
