import express from "express";
import { env } from "./config/env";
import router from "./routes/health.routes";
import authRouter from "./modules/auth/auth.routes";
import userRouter from "./modules/users/user.routes";
import tripRouter from "./modules/trips/trip.routes";
import itineraryRouter from "./modules/itineraries/itinerary.routes";
import itineraryDayRouter from "./modules/itinerary-days/itinerary-day.routes";

const app = express();

app.use(express.json());
app.use(router);

app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/trips", tripRouter);
app.use("/api/itineraries", itineraryRouter);
app.use("/api/itinerary-days", itineraryDayRouter);

export default app;
