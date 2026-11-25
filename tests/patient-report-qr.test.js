import { expect, it, vi } from "vitest";
import { POST } from "../src/app/api/reports/bundle/route";
import { GET } from "../src/app/api/reports/bundle/[token]/route";

const { prisma, reports, bundles } = vi.hoisted(() => {
  const reports = [];
  const bundles = [];
  const scoped = (row, where) =>
    row.ownerId === where.ownerId &&
    (!where.patientReference || row.patientReference === where.patientReference);
  const prisma = {
    $queryRaw: vi.fn(),
    $transaction: (callback) => callback(prisma),
    report: {
      findFirst: async ({ where }) => reports.find(row => row.id === where.id && scoped(row, where)),
      findMany: async ({ where }) => reports.filter(row => scoped(row, where) && (!where.id || where.id.in.includes(row.id))),
    },
    reportBundleShareToken: {
      findFirst: async ({ where }) => bundles.find(row => scoped(row, where)),
      findUnique: async ({ where }) => bundles.find(row => row.tokenHash === where.tokenHash),
      create: async ({ data }) => { bundles.push(data); return data; },
      update: vi.fn(),
    },
  };
  return { prisma, reports, bundles };
});
vi.mock("../src/lib/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("../src/lib/api-auth", () => ({ requireUser: async () => ({ prisma, user: { id: "owner" } }) }));
vi.mock("../src/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({ storage: { from: () => ({
    createSignedUrl: async () => ({ data: { signedUrl: "https://example.test/private-file" } }),
  }) } }),
}));

it("reuses an existing PIN-protected QR and exposes later reports only within its owner and patient scope", async () => {
  vi.stubEnv("REPORT_QR_SECRET", "test-only-key");
  try {
    const report = { ownerId: "owner", patientReference: "P-1", reportDate: new Date() };
    reports.push({ ...report, id: "first" });
    const request = (patientReportId, pin) => new Request("http://localhost:3000/api/reports/bundle", {
      method: "POST", body: JSON.stringify({ patientReportId, pin }),
    });
    const first = await POST(request("first", "1234"));
    expect(first.status).toBe(201);
    const { url } = await first.json();
    reports.push({ ...report, id: "later" }, { ...report, id: "other", patientReference: "P-2" },
      { ...report, id: "other-owner", ownerId: "different" });
    const later = await POST(request("later", "9999"));
    expect(later.status).toBe(200);
    expect((await later.json()).url).toBe(url);
    expect(bundles).toHaveLength(1);
    const params = { token: url.split("/").at(-1) };
    expect((await GET(new Request(url), { params })).status).toBe(401);
    const opened = await GET(new Request(url, { headers: { "x-report-pin": "1234" } }), { params });
    expect((await opened.json()).reports.map(row => row.id)).toEqual(["first", "later"]);
  } finally {
    vi.unstubAllEnvs();
  }
});
