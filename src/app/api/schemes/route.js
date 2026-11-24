import seed from "../../../features/schemes/data/schemes.json";
import { getPrisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function mapScheme(row, index) {
  const name = row.name || row.title || row.scheme_name || row.scheme || "";
  if (!name) return null;
  const documents = Array.isArray(row.documents) ? row.documents : [];
  const disabilities = Array.isArray(row.disability_required || row.disabilityRequired)
    ? (row.disability_required || row.disabilityRequired)
    : [];
  const rawIncomeLimit = row.income_limit ?? row.incomeLimit;
  const incomeLimit = rawIncomeLimit == null || rawIncomeLimit === "" || !Number.isFinite(Number(rawIncomeLimit))
    ? null
    : Number(rawIncomeLimit);
  return {
    id: String(row.id || row.scheme_id || `gov-data-${index}`),
    name,
    description: row.description || row.details || row.benefits || row.benefit || "See the official scheme portal for details.",
    benefits: row.benefits || row.benefit || row.description || "Refer to the official scheme portal.",
    documents,
    applyLink: row.apply_url || row.applyUrl || row.apply_link || row.url || row.website || "",
    scope: row.state || "All India",
    category: row.category || "health",
    eligibility: {
      minAge: row.min_age ?? row.minAge ?? null,
      maxAge: row.max_age ?? row.maxAge ?? null,
      incomeLimit,
      disabilities,
      states: row.state && row.state !== "All India" ? [row.state] : ["All"],
      gender: row.gender || "All",
      landless: row.landless ?? null,
      occupation: row.occupation || "All",
    },
  };
}

export async function GET() {
  let prismaSchemes = [];
  const prisma = getPrisma();
  if (prisma) {
    try {
      const data = await prisma.scheme.findMany({ orderBy: { name: "asc" } });
      prismaSchemes = data.map(mapScheme).filter(Boolean);
    } catch (error) {
      console.error("Could not load schemes from Prisma Postgres", error.name || "database error");
    }
  }

  let governmentSchemes = [];
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  const resourceId = process.env.DATA_GOV_IN_RESOURCE_ID;
  if (apiKey && resourceId) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const url = new URL(`https://api.data.gov.in/resource/${encodeURIComponent(resourceId)}`);
        url.searchParams.set("api-key", apiKey);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "100");
        const response = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
        if (!response.ok) throw new Error(`data.gov.in returned ${response.status}`);
        const payload = await response.json();
        governmentSchemes = (payload.records || []).map(mapScheme).filter(Boolean);
        break;
      } catch (error) {
        console.error(`data.gov.in scheme request failed (attempt ${attempt + 1})`, error);
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  if (prisma && governmentSchemes.length) {
    try {
      await Promise.all(governmentSchemes.map((scheme) => prisma.scheme.upsert({
        where: { id: scheme.id },
        create: {
          id: scheme.id,
          name: scheme.name,
          category: scheme.category,
          state: scheme.scope,
          minAge: scheme.eligibility.minAge,
          maxAge: scheme.eligibility.maxAge,
          incomeLimit: scheme.eligibility.incomeLimit == null ? null : String(scheme.eligibility.incomeLimit),
          disabilityRequired: scheme.eligibility.disabilities,
          benefits: scheme.benefits,
          documents: scheme.documents,
          applyUrl: scheme.applyLink || null,
        },
        update: {
          name: scheme.name,
          category: scheme.category,
          state: scheme.scope,
          minAge: scheme.eligibility.minAge,
          maxAge: scheme.eligibility.maxAge,
          incomeLimit: scheme.eligibility.incomeLimit == null ? null : String(scheme.eligibility.incomeLimit),
          disabilityRequired: scheme.eligibility.disabilities,
          benefits: scheme.benefits,
          documents: scheme.documents,
          applyUrl: scheme.applyLink || null,
          updatedAt: new Date(),
        },
      })));
    } catch (error) {
      console.error("Could not cache data.gov.in schemes in Prisma Postgres", error.name || "database error");
    }
  }

  const sourceSchemes = governmentSchemes.length ? governmentSchemes : prismaSchemes;
  const merged = [...sourceSchemes, ...seed.map(mapScheme).filter(Boolean)];
  const unique = [...new Map(merged.map((scheme) => [scheme.id, scheme])).values()];
  return Response.json({
    schemes: unique,
    source: governmentSchemes.length ? "data.gov.in" : prismaSchemes.length ? "prisma" : "seeded-demo",
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
