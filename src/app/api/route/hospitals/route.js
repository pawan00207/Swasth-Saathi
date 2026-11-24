import seedHospitals from "../../../../features/accessible-routing/hospitals.json";
import { getPrisma } from "../../../../lib/prisma";

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = (value) => value * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const value = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export async function GET(request) {
  const search = new URL(request.url).searchParams;
  const latitude = Number(search.get("lat"));
  const longitude = Number(search.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: "Valid latitude and longitude are required." }, { status: 400 });
  }

  const radiusMeters = 10000;
  const query = `[out:json][timeout:10];(node["amenity"~"hospital|clinic"](around:${radiusMeters},${latitude},${longitude});way["amenity"~"hospital|clinic"](around:${radiusMeters},${latitude},${longitude});relation["amenity"~"hospital|clinic"](around:${radiusMeters},${latitude},${longitude}););out center tags;`;
  const endpoint = process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SwasthSaathiHealthcareDemo/1.0" },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const data = await response.json();
    const prisma = getPrisma();
    let bedRows = [];
    if (prisma) {
      try {
        bedRows = await prisma.hospital.findMany({
          select: {
            name: true, latitude: true, longitude: true, demo: true,
            accessibilitySource: true, accessibilityLastVerified: true,
            ramp: true, elevator: true, wheelchairEntrance: true, accessibleParking: true,
            bedInventory: { select: { bedType: true, total: true, available: true, updatedAt: true } },
          },
        });
      } catch (error) {
        console.error("Could not load Prisma bed inventory for nearby hospitals", error.name || "database error");
      }
    }

    const nearby = (data.elements || []).map((element) => {
      const tags = element.tags || {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const nearest = bedRows
        .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude))
        .map((row) => ({ row, distance: distanceKm(lat, lon, row.latitude, row.longitude) }))
        .filter((item) => item.distance <= 1)
        .sort((a, b) => a.distance - b.distance)[0]?.row;
      return {
        id: `osm-${element.type}-${element.id}`,
        name: tags.name || tags["name:en"] || "Unnamed medical facility",
        lat,
        lon,
        distanceKm: Number(distanceKm(latitude, longitude, lat, lon).toFixed(1)),
        emergency: tags.emergency || null,
        wheelchair: tags.wheelchair || null,
        speciality: tags["healthcare:speciality"] || null,
        icuAvailable: nearest?.bedInventory?.find((bed) => bed.bedType === "ICU")?.available ?? null,
        bedInventoryMatched: Boolean(nearest),
        bedInventorySource: nearest ? (nearest.demo ? "demo seed" : "hospital inventory") : null,
        accessibility: nearest ? {
          ramp: nearest.ramp,
          elevator: nearest.elevator,
          wheelchairEntrance: nearest.wheelchairEntrance,
          accessibleParking: nearest.accessibleParking,
          source: nearest.accessibilitySource,
          lastVerified: nearest.accessibilityLastVerified,
        } : null,
      };
    }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);

    return Response.json({
      source: "openstreetmap-overpass",
      hospitals: nearby,
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not fetch nearby hospitals from Overpass", error);
    const fallback = seedHospitals.map((hospital) => ({
      ...hospital,
      distanceKm: Number(distanceKm(latitude, longitude, hospital.lat, hospital.lng).toFixed(1)),
      emergency: null,
      wheelchair: null,
      icuAvailable: null,
      bedInventoryMatched: false,
      bedInventorySource: null,
    })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
    return Response.json({
      source: "seeded-demo",
      error: "Nearby map service is unavailable. Showing distant seeded hospitals; verify before travel.",
      hospitals: fallback,
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}
