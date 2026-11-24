import { getLiveHospitals } from "../../../lib/hospital-inventory";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") || "";
  const result = await getLiveHospitals({ city });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
