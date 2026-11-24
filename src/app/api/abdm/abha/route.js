import { lookupAbhaProfile } from "../../../../lib/abdm/client";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier || identifier.length > 100) {
    return Response.json({ error: "Enter a valid 14-digit ABHA Number or ABHA Address (e.g. name@abdm)." }, { status: 400 });
  }

  const result = await lookupAbhaProfile(identifier);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
