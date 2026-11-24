import { getPrisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/api-auth";
import { DEFAULT_SERVICE_CATALOG } from "../../../lib/service-catalog";
import { writeAuditLog } from "../../../lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const prisma = getPrisma();
  if (prisma) {
    try {
      const rows = await prisma.serviceCatalog.findMany({ orderBy: { name: "asc" } });
      if (rows.length > 0) {
        return Response.json({
          source: "prisma",
          items: rows.map((row) => ({
            id: row.id,
            name: row.name,
            descriptionEn: row.descriptionEn,
            descriptionHi: row.descriptionHi,
            gstRate: Number(row.gstRate),
            category: row.category,
          })),
        }, { headers: { "Cache-Control": "no-store" } });
      }
    } catch (error) {
      console.warn("Could not read service_catalog from Prisma", error?.message || "db error");
    }
  }
  return Response.json({ source: "seeded-default", items: DEFAULT_SERVICE_CATALOG }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const context = await requireUser(request);
  if (context.response) return context.response;
  if (context.profile.role !== "hospital_admin" || !context.profile.hospitalId) {
    return Response.json({ error: "Hospital administrator access required." }, { status: 403 });
  }
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const descriptionEn = typeof body.descriptionEn === "string" ? body.descriptionEn.trim().slice(0, 300) : "";
  const descriptionHi = typeof body.descriptionHi === "string" ? body.descriptionHi.trim().slice(0, 300) : "";
  const gstRate = Number(body.gstRate ?? 0);
  if (!name || !descriptionEn || ![0, 5, 12, 18].includes(gstRate)) {
    return Response.json({ error: "Valid service name, English explanation, and GST slab (0, 5, 12, 18) are required." }, { status: 400 });
  }
  const item = await context.prisma.serviceCatalog.upsert({
    where: { name },
    create: {
      name,
      descriptionEn,
      descriptionHi: descriptionHi || descriptionEn,
      gstRate,
      category: typeof body.category === "string" ? body.category.trim().slice(0, 40) : "clinical",
    },
    update: {
      descriptionEn,
      descriptionHi: descriptionHi || descriptionEn,
      gstRate,
    },
  });
  await writeAuditLog(context.prisma, {
    entityType: "service_catalog",
    entityId: item.id,
    actorId: context.user.id,
    action: "upserted",
    details: { name: item.name, gstRate },
  });
  return Response.json({ item }, { status: 201 });
}
