import express from "express";
import { env } from "./config/env";
import authRouter from "./modules/auth/auth.routes";
import userRouter from "./modules/users/user.routes";
import tripRouter from "./modules/trips/trip.routes";
import itineraryRouter from "./modules/itineraries/itinerary.routes";
import itineraryDayRouter from "./modules/itinerary-days/itinerary-day.routes";
import activityRouter from "./modules/activities/activity.routes";
import placesRouter from "./modules/places/places.routes";
import generationJobRouter from "./modules/generation-jobs/generation-job.routes";

const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/trips", tripRouter);
app.use("/api/itineraries", itineraryRouter);
app.use("/api/itinerary-days", itineraryDayRouter);
app.use("/api/activities", activityRouter);
app.use("/api/places", placesRouter);
app.use("/api/generation-jobs", generationJobRouter);

export default app;
