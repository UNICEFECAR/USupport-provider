import express from "express";
import helmet from "helmet";
import dotenv from "dotenv";

import v1 from "#routes/index";
import middleware from "#middlewares/index";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

/*------------- Security Config -------------*/

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());

/*------------- Provider Service Endpoints -------------*/

app.use("/provider/v1/provider", v1.ProviderRouter);
app.use("/provider/v1/availability", v1.AvailabilityRouter);
app.use("/provider/v1/consultation", v1.ConsultationRouter);
app.use("/provider/v1/calendar", v1.CalendarRouter);
app.use("/provider/v1/services", v1.ServiceRouter);

/*------------- Error middleware -------------*/

app.use(middleware.errorMiddleware.notFound);
app.use(middleware.errorMiddleware.errorHandler);

app.listen(PORT, () => {
  console.log(`Provider Server listening on port ${PORT}`);
});
