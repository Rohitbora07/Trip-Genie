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
  ADMIN_EMAIL: z.string().email()
});

export const env = envSchema.parse(process.env);