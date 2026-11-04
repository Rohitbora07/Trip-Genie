import { prisma } from "./prisma";

async function main() {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("PostgreSQL connection successful");
}

main()
    .catch((error) => {
        console.error("PostgreSQL connection failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });