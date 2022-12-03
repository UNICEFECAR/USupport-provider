import schedule from "node-schedule";

import { clearPendingConsultationsJob } from "#utils/jobs";

export const scheduleJobs = () => {
  // Run every five minutes
  schedule.scheduleJob("*/5 * * * *", async () => {
    await clearPendingConsultationsJob();
  });
};
