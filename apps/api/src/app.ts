import express from "express";
import { env } from "./config/env";
import router from "./routes/health.routes";
import authRouter from "./modules/auth/auth.routes";

const app = express();

app.use(express.json());
app.use(router);

app.use("/api/auth", authRouter);

export default app;
