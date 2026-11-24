import { afterEach, describe, expect, it } from "vitest";
import { getPublicBaseUrl, isLocalhostOrigin } from "../src/lib/url";
import { buildReportPdfBuffer } from "../src/lib/pdf-builder";
import { getVaultReport, isValidReportId, saveVaultReport } from "../src/lib/report-vault";
import { getLiveHospitals } from "../src/lib/hospital-inventory";

describe("Public QR URL resolution", () => {
  const origAppBaseUrl = process.env.APP_BASE_URL;

  afterEach(() => {
    if (origAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = origAppBaseUrl;
  });

  it("uses x-forwarded-host and never returns localhost when behind reverse proxy", () => {
    delete process.env.APP_BASE_URL;
    const req = new Request("http://localhost:3000/api/reports/vault", {
      headers: {
        "x-forwarded-host": "ais-dev-example.asia-southeast1.run.app",
        "x-forwarded-proto": "https",
      },
    });
    const base = getPublicBaseUrl(req);
    expect(base).toBe("https://ais-dev-example.asia-southeast1.run.app");
    expect(isLocalhostOrigin(base)).toBe(false);
  });

  it("prioritizes non-localhost APP_BASE_URL when configured", () => {
    process.env.APP_BASE_URL = "https://santa-pedicure-reclusive.ngrok-free.dev/some/path";
    const req = new Request("http://localhost:3000/api/reports/share");
    expect(getPublicBaseUrl(req)).toBe("https://santa-pedicure-reclusive.ngrok-free.dev");
  });

  it("ignores malformed x-forwarded-host headers", () => {
    delete process.env.APP_BASE_URL;
    const req = new Request("http://localhost:3000/api/public-config", {
      headers: {
        "x-forwarded-host": "bad host/../../etc",
        host: "swasth-saathi.example.org",
      },
    });
    expect(getPublicBaseUrl(req)).toBe("https://swasth-saathi.example.org");
  });
});

describe("Report vault & downloadable PDF generation", () => {
  it("blocks path traversal report IDs", () => {
    expect(isValidReportId("../etc/passwd")).toBe(false);
    expect(isValidReportId("REC-2026-001")).toBe(true);
  });

  it("saves and retrieves uploaded report files and builds valid PDF buffers", () => {
    const id = `REC-TEST-${Date.now().toString(36)}`;
    const sampleBytes = Buffer.from("%PDF-1.4\n%test\n%%EOF", "utf8");
    saveVaultReport({
      id,
      patientName: "Priya Verma",
      reportType: "Pathology",
      reportDate: "2026-11-24",
      doctor: "Dr. Meera Sharma",
      notes: "CBC within reference limits",
      fileName: "cbc.pdf",
      mimeType: "application/pdf",
      fileBuffer: sampleBytes,
    });
    const fetched = getVaultReport(id);
    expect(fetched).toBeTruthy();
    expect(fetched.patientName).toBe("Priya Verma");
    expect(fetched.fileBuffer?.toString("utf8")).toContain("%PDF-1.4");

    const generatedPdf = buildReportPdfBuffer({
      id: "REC-AIIMS-2026-0412",
      patientName: "Aarav Sharma",
      reportType: "Cardiology",
      reportDate: "2026-11-22",
      doctor: "Dr. Karthik Iyer",
      notes: "ECG Normal Sinus Rhythm",
    });
    expect(generatedPdf.toString("utf8").startsWith("%PDF-1.4")).toBe(true);
    expect(generatedPdf.toString("utf8")).toContain("SWASTH SAATHI");
  });
});

describe("Hospital bed inventory & Supabase/API state", () => {
  it("returns normalized hospital inventory without demo flags", async () => {
    const res = await getLiveHospitals();
    expect(Array.isArray(res.hospitals)).toBe(true);
    expect(res.hospitals.length).toBeGreaterThan(0);
    for (const h of res.hospitals) {
      expect("demo" in h).toBe(false);
      expect(typeof h.icu).toBe("number");
    }
  });
});
