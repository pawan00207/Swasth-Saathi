import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTelegramDedupeForTests,
  formatBedRequestTelegramMessage,
  formatSosHospitalPreAlertTelegramMessage,
  formatSosAlertTelegramMessage,
  isTelegramConfigured,
  maskChatId,
  notifyBedRequestTelegram,
  notifySosHospitalPreAlertTelegram,
  notifySosAlertTelegram,
  sendTelegramMessage,
} from "../src/lib/telegram.js";

describe("Telegram Notification Service", () => {
  const originalEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TELEGRAM_EMERGENCY_CHAT_ID: process.env.TELEGRAM_EMERGENCY_CHAT_ID,
    TELEGRAM_SOS_CHAT_ID: process.env.TELEGRAM_SOS_CHAT_ID,
  };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearTelegramDedupeForTests();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_EMERGENCY_CHAT_ID;
    delete process.env.TELEGRAM_SOS_CHAT_ID;
  });

  afterEach(() => {
    clearTelegramDedupeForTests();
    globalThis.fetch = originalFetch;
    if (originalEnv.TELEGRAM_BOT_TOKEN !== undefined) {
      process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN;
    } else {
      delete process.env.TELEGRAM_BOT_TOKEN;
    }
    if (originalEnv.TELEGRAM_CHAT_ID !== undefined) {
      process.env.TELEGRAM_CHAT_ID = originalEnv.TELEGRAM_CHAT_ID;
    } else {
      delete process.env.TELEGRAM_CHAT_ID;
    }
    if (originalEnv.TELEGRAM_EMERGENCY_CHAT_ID !== undefined) {
      process.env.TELEGRAM_EMERGENCY_CHAT_ID = originalEnv.TELEGRAM_EMERGENCY_CHAT_ID;
    } else {
      delete process.env.TELEGRAM_EMERGENCY_CHAT_ID;
    }
    if (originalEnv.TELEGRAM_SOS_CHAT_ID !== undefined) {
      process.env.TELEGRAM_SOS_CHAT_ID = originalEnv.TELEGRAM_SOS_CHAT_ID;
    } else {
      delete process.env.TELEGRAM_SOS_CHAT_ID;
    }
  });

  it("handles missing Telegram credentials gracefully without throwing", async () => {
    expect(isTelegramConfigured()).toBe(false);
    const res = await sendTelegramMessage({ text: "Test notification" });
    expect(res.ok).toBe(false);
    expect(res.configured).toBe(false);
    expect(res.status).toBe("unconfigured");
  });

  it("formats Bed Request notification with required metadata and excludes sensitive patient info", () => {
    const msg = formatBedRequestTelegramMessage({
      bedRequest: {
        id: "req-123",
        bedType: "ICU",
        status: "pending",
        patientName: "Secret Patient Name",
        patientPhone: "+919999999999",
        reason: "Confidential clinical notes",
        attachedReportId: "report-999",
        createdAt: "2026-11-24T10:00:00.000Z",
      },
      hospitalName: "AIIMS New Delhi",
    });

    expect(msg).toContain("req-123");
    expect(msg).toContain("AIIMS New Delhi");
    expect(msg).toContain("ICU");
    expect(msg).toContain("PENDING");
    expect(msg).toContain("2026-11-24T10:00:00.000Z");

    expect(msg).not.toContain("Secret Patient Name");
    expect(msg).not.toContain("9999999999");
    expect(msg).not.toContain("Confidential clinical notes");
    expect(msg).not.toContain("report-999");
  });

  it("formats SOS alert prominently and includes location only when explicitly shared", () => {
    const sosEvent = {
      id: "sos-456",
      status: "sent",
      isDrill: false,
      latitude: 28.5672,
      longitude: 77.21,
      addressText: "Ansari Nagar Gate 1",
      createdAt: "2026-11-24T10:05:00.000Z",
    };

    const privateMsg = formatSosAlertTelegramMessage({ sosEvent, locationShared: false });
    expect(privateMsg).toContain("🚨 EMERGENCY SOS ALERT");
    expect(privateMsg).toContain("sos-456");
    expect(privateMsg).toContain("SENT");
    expect(privateMsg).toContain("2026-11-24T10:05:00.000Z");
    expect(privateMsg).toContain("Not shared by patient");
    expect(privateMsg).not.toContain("28.5672");
    expect(privateMsg).not.toContain("Ansari Nagar");

    const sharedMsg = formatSosAlertTelegramMessage({ sosEvent, locationShared: true });
    expect(sharedMsg).toContain("🚨 EMERGENCY SOS ALERT");
    expect(sharedMsg).toContain("https://www.google.com/maps?q=28.5672,77.21");
    expect(sharedMsg).toContain("Ansari Nagar Gate 1");
  });

  it("sends a hospital pre-alert to the emergency Telegram chat without patient details", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "unit-test-token-value";
    process.env.TELEGRAM_CHAT_ID = "123456789";
    process.env.TELEGRAM_EMERGENCY_CHAT_ID = "987654321";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 778 } }),
    }));
    globalThis.fetch = fetchMock;

    const message = formatSosHospitalPreAlertTelegramMessage({
      sosEvent: {
        id: "sos-prealert-1",
        isDrill: false,
        createdAt: "2026-11-24T10:20:00.000Z",
      },
      hospitalName: "Safdarjung Hospital",
      bedType: "ICU",
    });
    expect(message).toContain("EMERGENCY HOSPITAL PRE-ALERT");
    expect(message).toContain("Safdarjung Hospital");
    expect(message).toContain("ICU");
    expect(message).not.toContain("patient");

    const result = await notifySosHospitalPreAlertTelegram({
      sosEvent: { id: "sos-prealert-1", isDrill: false },
      hospitalName: "Safdarjung Hospital",
      hospitalId: "hospital-1",
      bedType: "ICU",
    });
    const duplicate = await notifySosHospitalPreAlertTelegram({
      sosEvent: { id: "sos-prealert-1", isDrill: false },
      hospitalName: "Safdarjung Hospital",
      hospitalId: "hospital-1",
      bedType: "ICU",
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(778);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).chat_id).toBe("987654321");
    expect(fetchMock.mock.calls[0][0]).toContain("/sendMessage");
    expect(duplicate.deduplicated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses TELEGRAM_SOS_CHAT_ID for emergency alerts when no other SOS chat is set", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "unit-test-token-value";
    process.env.TELEGRAM_SOS_CHAT_ID = "8435808976";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 779 } }),
    }));
    globalThis.fetch = fetchMock;

    expect(isTelegramConfigured({ emergency: true })).toBe(true);
    const result = await notifySosAlertTelegram({
      sosEvent: { id: "sos-chat-alias-test", status: "sent", isDrill: true },
      locationShared: false,
    });

    expect(result.ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).chat_id).toBe("8435808976");
  });

  it("sends via Telegram Bot API sendMessage and prevents duplicate notifications", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "unit-test-token-value";
    process.env.TELEGRAM_CHAT_ID = "123456789";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 777 } }),
    }));
    globalThis.fetch = fetchMock;

    const first = await notifyBedRequestTelegram({
      bedRequest: {
        id: "req-dedupe-1",
        bedType: "Oxygen",
        status: "pending",
        createdAt: "2026-11-24T10:10:00.000Z",
      },
      hospitalName: "Safdarjung Hospital",
    });

    const second = await notifyBedRequestTelegram({
      bedRequest: {
        id: "req-dedupe-1",
        bedType: "Oxygen",
        status: "pending",
        createdAt: "2026-11-24T10:10:00.000Z",
      },
      hospitalName: "Safdarjung Hospital",
    });

    expect(first.ok).toBe(true);
    expect(first.messageId).toBe(777);
    expect(first.recipientMask).toBe(maskChatId("123456789"));
    expect(JSON.stringify(first)).not.toContain("unit-test-token-value");

    expect(second.ok).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/sendMessage");
  });

  it("isolates Telegram API errors so SOS and Bed Request flows never fail", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "unit-test-token-value";
    process.env.TELEGRAM_CHAT_ID = "123456789";

    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error_code: 500, description: "Internal error" }),
    }));

    const sosResult = await notifySosAlertTelegram({
      sosEvent: {
        id: "sos-fail-safe",
        status: "sent",
        isDrill: true,
        createdAt: "2026-11-24T10:15:00.000Z",
      },
      locationShared: false,
    });

    expect(sosResult.ok).toBe(false);
    expect(sosResult.status).toBe("failed");
    expect(JSON.stringify(sosResult)).not.toContain("unit-test-token-value");
  });
});
