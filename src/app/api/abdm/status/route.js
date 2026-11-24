import { getAbdmConfig, isAbdmConfigured, testAbdmConnection } from "../../../../lib/abdm/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getAbdmConfig();
  const configured = isAbdmConfigured();
  const liveConnected = configured ? await testAbdmConnection() : false;

  return Response.json(
    {
      configured,
      liveConnected,
      gatewayUrl: cfg.baseUrl,
      cmId: cfg.cmId,
      hipId: cfg.hipId,
      hiuId: cfg.hiuId,
      milestones: [
        { id: "M1", name: "ABHA Creation & Verification (V3)", status: liveConnected ? "live" : "ready" },
        { id: "M2", name: "HIP Care Context Linking & Discovery", status: liveConnected ? "live" : "ready" },
        { id: "M3", name: "HIU Consent Manager & FHIR Pull", status: liveConnected ? "live" : "ready" },
      ],
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
