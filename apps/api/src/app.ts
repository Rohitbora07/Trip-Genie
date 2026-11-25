import express from "express";
import cors from "cors";
import { env } from "./config/env";
import authRouter from "./modules/auth/auth.routes";
import userRouter from "./modules/users/user.routes";
import tripRouter from "./modules/trips/trip.routes";
import itineraryRouter from "./modules/itineraries/itinerary.routes";
import itineraryDayRouter from "./modules/itinerary-days/itinerary-day.routes";
import activityRouter from "./modules/activities/activity.routes";
import placesRouter from "./modules/places/places.routes";
import generationJobRouter from "./modules/generation-jobs/generation-job.routes";
import recoveryProposalRouter from "./modules/recovery-proposals/recovery-proposal.routes";

const app = express();

app.use(
  cors({
    origin: [
      env.WEB_ORIGIN,
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:4000",
      "http://127.0.0.1:4000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  })
);

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/trips", tripRouter);
app.use("/api/itineraries", itineraryRouter);
app.use("/api/itinerary-days", itineraryDayRouter);
app.use("/api/activities", activityRouter);
app.use("/api/places", placesRouter);
app.use("/api/generation-jobs", generationJobRouter);
app.use("/api/recovery-proposals", recoveryProposalRouter);

export default app;
