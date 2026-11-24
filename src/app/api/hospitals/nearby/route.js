import { getLiveHospitals } from "../../../../lib/hospital-inventory";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const { hospitals, source } = await getLiveHospitals();
  const withDistance = hospitals.map((h) => ({
    ...h,
    distance: Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
      ? Math.round(Math.hypot((h.lat || 0) - lat, (h.lng || 0) - lng) * 111 * 10) / 10
      : h.distance,
  }));
  return Response.json(
    { hospitals: withDistance.sort((a, b) => a.distance - b.distance), source },
    { headers: { "Cache-Control": "no-store" } },
  );
}
