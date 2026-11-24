import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  getPrisma: vi.fn(),
}));
vi.mock("../src/lib/supabase/server", () => ({
  getAuthenticatedUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("../src/lib/audit", () => ({
  writeAuditLog: vi.fn(),
}));
vi.mock("../src/lib/whatsapp/provider", () => ({
  sendWhatsAppMessage: vi.fn(),
}));
vi.mock("../src/lib/url", () => ({
  getPublicBaseUrl: vi.fn(),
}));
vi.mock("../src/lib/hospital-inventory", () => ({
  getLiveHospitals: vi.fn(),
}));
vi.mock("../src/lib/telegram", () => ({
  notifySosAlertTelegram: vi.fn(),
}));

import { getPrisma } from "../src/lib/prisma";
import { getAuthenticatedUser, getSupabaseAdmin } from "../src/lib/supabase/server";
import { getPublicBaseUrl } from "../src/lib/url";
import { getLiveHospitals } from "../src/lib/hospital-inventory";
import { notifySosAlertTelegram } from "../src/lib/telegram";
import { POST } from "../src/app/api/sos/route";

describe("SOS Telegram delivery status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPrisma.mockReturnValue(null);
    getSupabaseAdmin.mockReturnValue(null);
    getPublicBaseUrl.mockReturnValue("http://localhost:3001");
    getLiveHospitals.mockResolvedValue({ hospitals: [], source: "test" });
    notifySosAlertTelegram.mockResolvedValue({
      ok: false,
      configured: false,
      status: "unconfigured",
      provider: "telegram",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("attempts Telegram for signed-in SOS even when fallback database persistence fails", async () => {
    const table = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "TEST_DB_UNAVAILABLE" },
      }),
    };
    const supabase = { from: vi.fn(() => table) };
    getSupabaseAdmin.mockReturnValue(supabase);
    getAuthenticatedUser.mockResolvedValue({ id: "sos-user-test", user_metadata: {} });

    const response = await POST(new Request("http://localhost/api/sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        neededBedType: "ICU",
        isDrill: true,
        idempotencyKey: "sos-telegram-test-1",
      }),
    }));
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(notifySosAlertTelegram).toHaveBeenCalledTimes(1);
    expect(result.telegram).toEqual({ sent: false, status: "unconfigured" });
  });
});
