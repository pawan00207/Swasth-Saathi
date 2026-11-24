import { describe, expect, it, vi } from "vitest";
import { sanitizeExternalPortalUrl } from "../src/lib/url";
import { computeHospitalSettlementTotals } from "../src/lib/billing-settlement";
import {
  createAadhaarOtpChallenge,
  evaluateSelfieBiometrics,
  isValidAadhaarNumber,
  maskAadhaar,
  parseSelfieDataUrl,
  verifyAadhaarOtpChallenge,
} from "../src/lib/abdm/verification";
import { formatPaymentSettlementTelegramMessage } from "../src/lib/telegram";
import { GET as getPatientDashboard } from "../src/app/api/patient/dashboard/route";

describe("Schemes portal URL sanitization", () => {
  it("allows valid https/http official portal URLs and blocks javascript/data schemes", () => {
    expect(sanitizeExternalPortalUrl("https://beneficiary.nha.gov.in")).toBe("https://beneficiary.nha.gov.in/");
    expect(sanitizeExternalPortalUrl("http://depwd.gov.in/adip-scheme")).toBe("http://depwd.gov.in/adip-scheme");
    expect(sanitizeExternalPortalUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeExternalPortalUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeExternalPortalUrl("not-a-url")).toBe("");
  });
});

describe("Care Wallet custom hospital settlement math & Telegram receipt", () => {
  it("computes subtotal, GST tax, discount, total, and paise accurately", () => {
    const res = computeHospitalSettlementTotals({ subtotal: 2500, gstRate: 12, discount: 100 });
    expect(res).toEqual({
      subtotal: 2500,
      gstRate: 12,
      tax: 300,
      discount: 100,
      total: 2700,
      amountPaise: 270000,
    });
  });

  it("formats non-sensitive Telegram settlement receipt message", () => {
    const msg = formatPaymentSettlementTelegramMessage({
      billNumber: "INV-HOSP-2026-01",
      hospitalName: "AIIMS New Delhi",
      amountInr: 2800,
      paymentId: "pay_Test123",
      timestamp: "2026-11-24T10:00:00.000Z",
    });
    expect(msg).toContain("Care Wallet Hospital Settlement");
    expect(msg).toContain("INV-HOSP-2026-01");
    expect(msg).toContain("AIIMS New Delhi");
    expect(msg).toContain("Rs. 2800.00");
    expect(msg).toContain("pay_Test123");
  });
});

describe("ABDM Aadhaar Verhoeff validation, masking & Face Verification", () => {
  it("validates Verhoeff Aadhaar checksum and masks digits", () => {
    // Valid Verhoeff checksum 12-digit number starting with >= 2
    expect(isValidAadhaarNumber("234123412346")).toBe(true);
    expect(isValidAadhaarNumber("234123412345")).toBe(false);
    expect(isValidAadhaarNumber("123456789012")).toBe(false);
    expect(isValidAadhaarNumber("000000000000")).toBe(false);
    expect(maskAadhaar("2341 2341 2346")).toBe("XXXX-XXXX-2346");
  });

  it("signs and verifies stateless Aadhaar OTP challenge tokens", () => {
    const token = createAadhaarOtpChallenge({
      txnId: "txn-123",
      maskedAadhaar: "XXXX-XXXX-2346",
      otpCode: "482910",
    });
    expect(verifyAadhaarOtpChallenge({ challengeToken: token, otpCode: "000000" }).valid).toBe(false);
    const ok = verifyAadhaarOtpChallenge({ challengeToken: token, otpCode: "482910" });
    expect(ok.valid).toBe(true);
    expect(ok.maskedAadhaar).toBe("XXXX-XXXX-2346");
  });

  it("rejects malformed or tiny selfie payloads and scores valid high-entropy JPEG payloads", () => {
    expect(parseSelfieDataUrl("data:text/plain;base64,SGVsbG8=").ok).toBe(false);

    // Construct synthetic high-entropy JPEG buffer > 2000 bytes
    const bytes = Buffer.alloc(3200);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    for (let i = 3; i < bytes.length; i += 1) {
      bytes[i] = (i * 73 + 19) % 256;
    }
    const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    const parsed = parseSelfieDataUrl(dataUrl);
    expect(parsed.ok).toBe(true);
    const bio = evaluateSelfieBiometrics(parsed.buffer, "aarav.sharma@abdm");
    expect(bio.livenessPassed).toBe(true);
    expect(bio.confidenceScore).toBeGreaterThanOrEqual(85);
  });
});

describe("Patient Dashboard API security", () => {
  it("rejects unauthenticated requests to /api/patient/dashboard", async () => {
    const req = new Request("http://localhost:3000/api/patient/dashboard", { method: "GET" });
    const res = await getPatientDashboard(req);
    expect([401, 503]).toContain(res.status);
  });
});
