import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api-auth", () => ({
  requireUser: vi.fn(),
}));
vi.mock("../src/lib/hospital-inventory", () => ({
  getLiveHospitals: vi.fn(),
}));
vi.mock("../src/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("../src/lib/telegram", () => ({
  notifySosHospitalPreAlertTelegram: vi.fn(),
}));

import { requireUser } from "../src/lib/api-auth";
import { getLiveHospitals } from "../src/lib/hospital-inventory";
import { writeAuditLog } from "../src/lib/audit";
import { notifySosHospitalPreAlertTelegram } from "../src/lib/telegram";
import { POST } from "../src/app/api/sos/pre-alert/route";

describe("Local SOS Telegram hospital pre-alert", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends an authenticated local SOS pre-alert to Telegram", async () => {
    const prisma = {
      hospital: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    requireUser.mockResolvedValue({
      response: null,
      user: { id: "patient-1" },
      prisma,
    });
    getLiveHospitals.mockResolvedValue({
      hospitals: [{ id: "hospital-1", name: "Safdarjung Hospital" }],
    });
    notifySosHospitalPreAlertTelegram.mockResolvedValue({ ok: true, provider: "telegram" });

    const response = await POST(new Request("http://localhost/api/sos/pre-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sosId: "SOS-LIVE-1764000000000",
        hospitalId: "hospital-1",
        bedType: "ICU",
        isDrill: true,
      }),
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      preAlerted: true,
      telegramSent: true,
      provider: "telegram",
      hospitalName: "Safdarjung Hospital",
    });
    expect(notifySosHospitalPreAlertTelegram).toHaveBeenCalledWith(expect.objectContaining({
      hospitalId: "hospital-1",
      hospitalName: "Safdarjung Hospital",
      bedType: "ICU",
    }));
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("rejects malformed or incomplete pre-alert details", async () => {
    requireUser.mockResolvedValue({
      response: null,
      user: { id: "patient-1" },
      prisma: null,
    });

    const response = await POST(new Request("http://localhost/api/sos/pre-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sosId: "not-an-sos", hospitalId: "hospital-1", bedType: "ICU" }),
    }));

    expect(response.status).toBe(400);
    expect(getLiveHospitals).not.toHaveBeenCalled();
    expect(notifySosHospitalPreAlertTelegram).not.toHaveBeenCalled();
  });

  it("returns delivery failures instead of reporting a false success", async () => {
    requireUser.mockResolvedValue({
      response: null,
      user: { id: "patient-1" },
      prisma: null,
    });
    getLiveHospitals.mockResolvedValue({
      hospitals: [{ id: "hospital-1", name: "Safdarjung Hospital" }],
    });
    notifySosHospitalPreAlertTelegram.mockResolvedValue({
      ok: false,
      configured: false,
      status: "unconfigured",
      provider: "telegram",
    });

    const response = await POST(new Request("http://localhost/api/sos/pre-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sosId: "SOS-LIVE-1764000000000",
        hospitalId: "hospital-1",
        bedType: "ICU",
      }),
    }));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/Telegram bot is not configured/);
  });
});
