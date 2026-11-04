import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";


const { PrismaClient } = require("../../generated/prisma/client");

const adapter = new PrismaPg({
   connectionString: env.DATABASE_URL
});

export const prisma = new PrismaClient({ adapter });