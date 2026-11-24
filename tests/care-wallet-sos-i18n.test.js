import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeInvoiceHash, isValidWhatsappPhone, maskPhone, normalizeWhatsappPhone } from "../src/lib/audit.js";
import { DEFAULT_SERVICE_CATALOG, explainLineItem } from "../src/lib/service-catalog.js";
import { formatCurrency, formatDate, formatNumber, normalizeLanguage, translateKey } from "../src/lib/i18n.js";
import { verifyMetaSignature, verifyTwilioSignature } from "../src/lib/whatsapp/provider.js";

describe("Care Wallet integrity & Service Catalog", () => {
  it("computes deterministic SHA-256 invoice hashes independent of item ordering", () => {
    const invA = {
      billNumber: "INV-20261124-TEST01",
      hospitalId: "hosp-1",
      subtotal: "1000.00",
      tax: "60.00",
      discount: "0.00",
      total: "1060.00",
      items: [
        { description: "Cardiology consultation", quantity: 1, unitPrice: 500, taxRate: 0 },
        { description: "Pharmacy", quantity: 1, unitPrice: 500, taxRate: 12 },
      ],
    };
    const invB = { ...invA, items: [...invA.items].reverse() };
    const hashA = computeInvoiceHash(invA);
    const hashB = computeInvoiceHash(invB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).toBe(hashB);

    const tampered = { ...invA, total: "1000.00" };
    expect(computeInvoiceHash(tampered)).not.toBe(hashA);
  });

  it("explains medical service line items in English and Hindi with fallback to item name", () => {
    const en = explainLineItem("Cardiology consultation", DEFAULT_SERVICE_CATALOG, "en");
    const hi = explainLineItem("Cardiology consultation", DEFAULT_SERVICE_CATALOG, "hi");
    const unknown = explainLineItem("Custom Hospital Procedure", DEFAULT_SERVICE_CATALOG, "en");
    expect(en).toContain("heart");
    expect(hi).toContain("हृदय");
    expect(unknown).toBe("Custom Hospital Procedure");
  });
});

describe("WhatsApp phone validation, masking & webhook signatures", () => {
  it("validates, normalizes, and masks WhatsApp phone numbers", () => {
    expect(normalizeWhatsappPhone("whatsapp:+91 98765-43210")).toBe("+919876543210");
    expect(normalizeWhatsappPhone("9876543210")).toBe("+919876543210");
    expect(isValidWhatsappPhone("+919876543210")).toBe(true);
    expect(isValidWhatsappPhone("123")).toBe(false);
    expect(maskPhone("+919876543210")).toBe("****3210");
  });

  it("verifies Twilio HMAC-SHA1 signatures accurately", () => {
    const authToken = "test_twilio_auth_token";
    const url = "https://example.ngrok.io/api/whatsapp/webhook";
    const params = { Body: "STATUS req-123", From: "whatsapp:+919876543210" };
    const payload = url + "BodySTATUS req-123" + "Fromwhatsapp:+919876543210";
    const signature = createHmac("sha1", authToken).update(payload).digest("base64");
    expect(verifyTwilioSignature({ url, params, signature, authToken })).toBe(true);
    expect(verifyTwilioSignature({ url, params, signature: "bad-sig", authToken })).toBe(false);
  });

  it("verifies Meta Cloud API X-Hub-Signature-256 signatures accurately", () => {
    const appSecret = "test_meta_app_secret";
    const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signatureHeader = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    expect(verifyMetaSignature({ rawBody, signatureHeader, appSecret })).toBe(true);
    expect(verifyMetaSignature({ rawBody, signatureHeader: "sha256=deadbeef", appSecret })).toBe(false);
  });
});

describe("Multilingual i18n & Intl formatting", () => {
  it("translates supported languages and falls back safely to English", () => {
    expect(normalizeLanguage("hi-IN")).toBe("hi");
    expect(normalizeLanguage("zz")).toBe("en");
    expect(translateKey("en", "wallet.title")).toBe("Care Wallet");
    expect(translateKey("hi", "wallet.title")).toBe("केयर वॉलेट");
    expect(translateKey("ta", "wallet.title")).toBe("கேர் வாலட்");
    expect(translateKey("bn", "sos.buttonLabel")).toContain("SOS");
  });

  it("formats INR currency, numbers, and dates using locale-aware Intl", () => {
    expect(formatCurrency(1250, "en")).toContain("1,250");
    expect(formatNumber(12345, "hi")).toBeTruthy();
    expect(formatDate("2026-11-24T00:00:00Z", "en")).toContain("2026");
  });
});
