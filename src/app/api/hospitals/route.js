import seed from "../../../features/beds/data/hospitals.json";
import { getPrisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function mapHospital(hospital) {
  const beds = Object.fromEntries((hospital.bedInventory || []).map((bed) => [bed.bedType.toLowerCase(), bed.available]));
  const updatedAt = (hospital.bedInventory || []).map((bed) => bed.updatedAt).sort((a, b) => b - a)[0];
  return {
    ...hospital,
    lat: hospital.latitude,
    lng: hospital.longitude,
    distance: 0,
    icu: beds.icu || 0,
    oxygen: beds.oxygen || 0,
    general: beds.general || 0,
    ventilator: beds.ventilator || 0,
    pediatric: 0,
    priceRange: "Not provided",
    lastUpdated: updatedAt?.toISOString() || hospital.updatedAt.toISOString(),
    accessibility: {
      ramp: hospital.ramp,
      elevator: hospital.elevator,
      wheelchairEntrance: hospital.wheelchairEntrance,
      accessibleParking: hospital.accessibleParking,
      source: hospital.accessibilitySource,
      lastVerified: hospital.accessibilityLastVerified,
    },
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const prisma = getPrisma();
  let upstreamStatus = null;
  if (prisma) {
    try {
      const rows = await prisma.hospital.findMany({
        include: { bedInventory: true },
        orderBy: { name: "asc" },
      });
      if (rows.length) {
        const hospitals = rows.map(mapHospital);
        const matches = city ? hospitals.filter((hospital) => hospital.city?.toLowerCase() === city.toLowerCase()) : hospitals;
        return Response.json({
          source: rows.some((hospital) => !hospital.demo) ? "prisma-live" : "prisma-demo",
          hospitals: matches,
          updatedAt: new Date().toISOString(),
        }, { headers: { "Cache-Control": "no-store" } });
      }
    } catch (error) {
      console.error("Could not load Prisma hospital inventory", error.name || "database error");
      upstreamStatus = "database-unavailable";
    }
  }

  const bedApiUrl = process.env.HOSPITAL_BED_API_URL;
  if (bedApiUrl) {
    try {
      const upstream = await fetch(bedApiUrl, {
        headers: process.env.HOSPITAL_BED_API_KEY ? { Authorization: `Bearer ${process.env.HOSPITAL_BED_API_KEY}` } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
      upstreamStatus = upstream.status;
      if (upstream.ok) {
        const data = await upstream.json();
        const liveHospitals = Array.isArray(data) ? data : (data.hospitals || []);
        if (liveHospitals.length) {
          return Response.json({
            source: "live-hms",
            hospitals: city ? liveHospitals.filter((hospital) => hospital.city?.toLowerCase() === city.toLowerCase()) : liveHospitals,
            updatedAt: new Date().toISOString(),
          }, { headers: { "Cache-Control": "no-store" } });
        }
      }
    } catch (error) {
      console.error("Live hospital bed API unavailable", error.name || "provider error");
      upstreamStatus = "unreachable";
    }
  }
  return Response.json({
    source: "seeded-demo",
    upstreamStatus,
    hospitals: city ? seed.filter((hospital) => hospital.city.toLowerCase() === city.toLowerCase()) : seed,
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
