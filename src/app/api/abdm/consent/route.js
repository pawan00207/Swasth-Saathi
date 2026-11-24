import { createAbdmConsentRequest } from "../../../../lib/abdm/client";

export const dynamic = "force-dynamic";

const ALLOWED_HI_TYPES = ["DiagnosticReport", "Prescription", "OPConsultation", "DischargeSummary", "ImmunizationRecord"];

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const abhaAddress = typeof body?.abhaAddress === "string" ? body.abhaAddress.trim() : "";
  if (!abhaAddress || !abhaAddress.includes("@")) {
    return Response.json({ error: "Valid ABHA Address (e.g. aarav.sharma@abdm) is required." }, { status: 400 });
  }

  const hiTypes = Array.isArray(body?.hiTypes)
    ? body.hiTypes.filter((item) => ALLOWED_HI_TYPES.includes(item))
    : ["DiagnosticReport", "Prescription"];

  const consent = await createAbdmConsentRequest({
    abhaAddress,
    hiTypes: hiTypes.length ? hiTypes : ["DiagnosticReport", "Prescription"],
  });

  return Response.json(consent, { status: 201, headers: { "Cache-Control": "no-store" } });
}
