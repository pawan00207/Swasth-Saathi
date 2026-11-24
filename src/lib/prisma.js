import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma;

function buildPgConfig(rawUrl) {
  let connectionString = String(rawUrl || "").trim();
  if (!connectionString) return null;
  const isSupabase = connectionString.includes("supabase.co") || connectionString.includes("supabase.com");
  if (isSupabase) {
    connectionString = connectionString.replace(/([?&])sslmode=(require|prefer|verify-ca)(&|$)/i, (_, p1, __, p3) =>
      p3 === "&" ? p1 : "",
    );
    return {
      connectionString,
      ssl: { rejectUnauthorized: false },
    };
  }
  return { connectionString };
}

export function getPrisma() {
  if (!prisma) {
    try {
      loadEnv({ path: ".env.local", override: true });
    } catch {
      // Safe no-op when .env.local is absent in production
    }
    const config = buildPgConfig(process.env.DATABASE_URL);
    if (!config) return null;
    try {
      const adapter = new PrismaPg(config);
      prisma = new PrismaClient({ adapter });
    } catch (error) {
      console.warn("[AI Studio] Database not connected — using fallback", error);
      return null;
    }
  }
  return prisma;
}
