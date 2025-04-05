import { PrismaClient } from "@prisma/client";

// Initialize Prisma Client as a singleton
const prisma = new PrismaClient();

export { prisma };
