import demoDoctors from "../../../features/teleconsult/data/doctors.json";
import { getPrisma } from "../../../lib/prisma";

export async function GET() {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const doctors = await prisma.doctor.findMany({ orderBy: { name: "asc" } });
      if (doctors.length) return Response.json({ doctors, source: "prisma" });
    } catch (error) {
      console.error("Could not load Prisma doctor directory", error.name || "database error");
    }
  }
  return Response.json({ doctors: demoDoctors, source: "seeded-demo" });
}
