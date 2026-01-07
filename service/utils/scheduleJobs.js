import schedule from "node-schedule";

import {
  clearPendingConsultationsJob,
  cancelNotAcceptedSuggestedConsultationsJob,
} from "#utils/jobs";

export const scheduleJobs = () => {
  // Run every five minutes
  schedule.scheduleJob("*/5 * * * *", async () => {
    await clearPendingConsultationsJob();
  });

  // Run every hour
  schedule.scheduleJob("0 */1 * * *", async () => {
    await cancelNotAcceptedSuggestedConsultationsJob();
  });
};
