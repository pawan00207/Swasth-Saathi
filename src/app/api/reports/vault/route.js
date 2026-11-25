// Legacy vault files have no owner metadata. Use the owner-scoped reports API.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ error: "Use the private reports workspace." }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}

export const POST = GET;
