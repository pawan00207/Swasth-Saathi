export async function GET(request, { params }) {
  return proxy(request, params.path, "GET");
}

export async function POST(request, { params }) {
  return proxy(request, params.path, "POST");
}

export async function PUT(request, { params }) {
  return proxy(request, params.path, "PUT");
}

export async function DELETE(request, { params }) {
  return proxy(request, params.path, "DELETE");
}

async function getDemoDhrsResponse(request, path, method) {
  if (path === "blockchain/status" && method === "GET") {
    return Response.json({
      status: "demo-active",
      mode: "dwn-demo-attestation",
      channel: "demo-accesshealth",
      message: "Local demo attestation ledger is active.",
    });
  }
  if (path === "blockchain/anchor" && method === "POST") {
    const body = await request.json();
    return Response.json({
      status: "demo-anchored",
      mode: "dwn-demo-attestation",
      hash: body.hash,
      channel: "demo-accesshealth",
      blockHeight: "1042",
      transactionId: `TX-DEMO-${Date.now()}`,
    });
  }
  if (path.startsWith("blockchain/verify/") && method === "GET") {
    const hash = decodeURIComponent(path.split("/").pop());
    return Response.json({
      verified: true,
      status: "demo-verified",
      mode: "dwn-demo-attestation",
      hash,
      channel: "demo-accesshealth",
      blockHeight: "1042",
      transactionId: "TX-DEMO-LOCAL-001",
    });
  }
  if (path === "reports/ocr" && method === "POST") {
    return Response.json({
      extractedText: "Demo OCR result: Patient report metadata received successfully. Text extraction is operating in demo mode until DHRS OCR is configured.",
      confidence: 0.75,
      mode: "demo-ocr",
      status: "active",
    });
  }
  if (path === "appointments" && method === "POST") {
    const body = await request.json();
    return Response.json({
      id: `APT-DEMO-${Date.now()}`,
      status: "confirmed",
      mode: "demo-live",
      ...body,
    });
  }
  if (path === "doctors" && method === "GET") {
    return Response.json({
      status: "active",
      mode: "demo-live",
      doctors: [],
    });
  }
  if (path === "appointments" && method === "GET") {
    return Response.json({
      status: "active",
      mode: "demo-live",
      appointments: [],
    });
  }
  if (path.startsWith("appointments/") && method === "GET") {
    const id = decodeURIComponent(path.split("/").pop());
    return Response.json({
      id,
      status: "demo-confirmed",
      mode: "demo-live",
    });
  }
  if (path.startsWith("appointments/") && method === "DELETE") {
    const id = decodeURIComponent(path.split("/").pop());
    return Response.json({
      id,
      status: "demo-cancelled",
      mode: "demo-live",
    });
  }
  if (path === "billing" && method === "GET") {
    return Response.json({
      status: "active",
      mode: "demo-live",
      bills: [],
    });
  }
  if (path === "billing" && method === "POST") {
    const body = await request.json();
    return Response.json({
      id: `BILL-DEMO-${Date.now()}`,
      status: "demo-created",
      mode: "demo-live",
      ...body,
    });
  }
  return null;
}

async function proxy(request, pathParts, method) {
  const baseUrl = (process.env.DHRS_API_URL || "http://localhost:5000").replace(/\/$/, "");
  const path = pathParts.join("/");
  const demoResponse = await getDemoDhrsResponse(request, path, method);
  if (demoResponse) return demoResponse;
  const search = new URL(request.url).search;
  const headers = {};
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;
  if (process.env.DHRS_API_KEY) headers.Authorization = `Bearer ${process.env.DHRS_API_KEY}`;

  try {
    const response = await fetch(`${baseUrl}/${path}${search}`, {
      method,
      headers,
      body: ["GET", "DELETE"].includes(method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("DHRS unavailable", error);
    return Response.json(
      { status: "unavailable", mode: "dwn-only", error: "DHRS is unavailable; DWN-only mode remains active." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
