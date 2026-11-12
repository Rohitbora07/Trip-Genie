import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
  SHADOW_DATABASE_URL: z.string().url(),
  AUTH_COOKIE_NAME: z.string().default("tripgenie_auth"),
  JWT_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  APP_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  AI_SERVICE_API_KEY: z.string().min(1),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(90000)
});

export const env = envSchema.parse(process.env);