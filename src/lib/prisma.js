import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma;

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}
